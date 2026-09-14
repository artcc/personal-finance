import { calculateIncome } from '../../income/domain/income.js';
import { projectCommitment, validateCommitment } from '../../commitments/domain/commitment.js';
import { assertClosable, calculatePlan, sourceKind } from '../../planning/domain/plan.js';
import { summarizeMovements, validateMovement } from '../../investments/domain/movements.js';
import { money, decimal } from '../../../shared/domain/money.js';
import { activeInMonth, reportedDate } from '../../../shared/domain/calendar.js';
import {
  incomeDefinitionSchema,
  commitmentDefinitionSchema,
} from '../../../shared/application/financial-input.js';
import { canonical, DataFileError } from './document.js';
import type { FinancialDocument } from './document.js';

function ensure(condition: unknown): asserts condition {
  if (!condition) throw new DataFileError('INVALID_DATA_FILE');
}
function unique<T>(rows: T[], key: (row: T) => string): void {
  ensure(new Set(rows.map(key)).size === rows.length);
}
function exactDecimal(left: string, right: string): boolean {
  const a = decimal(left);
  const b = decimal(right);
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

export function validateDocument(document: FinancialDocument, today: string): void {
  try {
    const data = document.data;
    for (const rows of Object.values(data))
      if (rows.length && 'id' in rows[0]!) unique(rows as Array<{ id: string }>, (row) => row.id);
    const accounts = new Map(data.accounts.map((row) => [row.id, row]));
    const spaces = new Map(data.spaces.map((row) => [row.id, row]));
    const incomeSources = new Map(data.incomeSources.map((row) => [row.id, row]));
    const commitments = new Map(data.commitmentSources.map((row) => [row.id, row]));
    const financing = new Map(data.financings.map((row) => [row.id, row]));
    const investments = new Map(data.investments.map((row) => [row.id, row]));
    const destination = (accountId: string, spaceId: string | null) => {
      ensure(accounts.has(accountId));
      if (spaceId !== null) ensure(spaces.get(spaceId)?.accountId === accountId);
    };
    data.spaces.forEach((row) => {
      ensure(accounts.has(row.accountId));
    });
    data.accounts.forEach((row) =>
      ensure(data.spaces.filter((space) => space.accountId === row.id).length <= 100),
    );
    unique(data.incomeRevisions, (row) => `${row.sourceId}:${row.version}`);
    unique(data.commitmentRevisions, (row) => `${row.sourceId}:${row.version}`);
    unique(data.commitmentInstallments, (row) => `${row.revisionId}:${row.ordinal}`);
    for (const row of data.incomeRevisions) {
      const source = incomeSources.get(row.sourceId);
      ensure(source && row.version <= source.version);
      destination(row.accountId, row.spaceId);
      const input = row.input;
      ensure(
        row.name === input.name &&
          row.effectiveFromMonth === input.effectiveFromMonth &&
          row.startsOn === input.startsOn &&
          row.endsOn === input.endsOn,
      );
      ensure(
        input.destination.accountId === row.accountId && input.destination.spaceId === row.spaceId,
      );
      const result = calculateIncome(input);
      ensure(
        row.baseCents === result.base.minorUnits &&
          row.vatCents === result.vat.minorUnits &&
          row.withholdingCents === result.withholding.minorUnits &&
          row.commissionCents === result.commission.minorUnits,
      );
      ensure(
        row.cashCents === result.expectedCash.minorUnits &&
          row.reserveCents === result.taxReserve.minorUnits &&
          row.spendableCents === result.spendableIncome.minorUnits,
      );
      ensure(
        exactDecimal(row.vatRate, input.vatRate) &&
          exactDecimal(row.withholdingRate, input.withholdingRate) &&
          exactDecimal(row.commissionRate, input.commissionRate),
      );
      ensure(
        row.hourlyRate === null
          ? input.hourlyRate === null
          : input.hourlyRate !== null && exactDecimal(row.hourlyRate, input.hourlyRate),
      );
      ensure(
        row.hours === null
          ? input.hours === null
          : input.hours !== null && exactDecimal(row.hours, input.hours),
      );
      if (source.oneOffMonth !== null) ensure(row.effectiveFromMonth === source.oneOffMonth);
    }
    for (const source of data.incomeSources) {
      ensure((source.recurrence === 'once') === (source.oneOffMonth !== null));
      ensure(data.incomeRevisions.some((row) => row.sourceId === source.id));
    }
    for (const row of data.commitmentRevisions) {
      const source = commitments.get(row.sourceId);
      ensure(source && row.version <= source.version);
      destination(row.accountId, row.spaceId);
      validateCommitment(row.input);
      ensure(
        row.name === row.input.name &&
          row.amountCents === row.input.amount.minorUnits &&
          row.effectiveFromMonth === row.input.effectiveFromMonth &&
          row.startsOn === row.input.startsOn &&
          row.endsOn === row.input.endsOn,
      );
      ensure(
        row.input.destination.accountId === row.accountId &&
          row.input.destination.spaceId === row.spaceId,
      );
      const installments = data.commitmentInstallments
        .filter((item) => item.revisionId === row.id)
        .sort((a, b) => a.ordinal - b.ordinal);
      ensure(installments.length === row.input.installments.length);
      installments.forEach((item, index) => {
        const original = row.input.installments[index];
        ensure(
          original &&
            item.ordinal === index &&
            item.month === original.month &&
            item.day === original.day &&
            item.amountCents === original.amount.minorUnits,
        );
      });
    }
    const revisionIds = new Set(data.commitmentRevisions.map((row) => row.id));
    data.commitmentInstallments.forEach((row) => ensure(revisionIds.has(row.revisionId)));
    data.commitmentSources.forEach((source) =>
      ensure(data.commitmentRevisions.some((row) => row.sourceId === source.id)),
    );
    const sourceLinks = [
      ...data.financings.map((row) => row.planningSourceId),
      ...data.investments.flatMap((row) => (row.planningSourceId ? [row.planningSourceId] : [])),
    ];
    unique(sourceLinks, (id) => id);
    const link = (sourceId: string, kind: 'financing' | 'investment') => {
      ensure(commitments.has(sourceId));
      const latest = data.commitmentRevisions
        .filter((row) => row.sourceId === sourceId)
        .sort((a, b) => b.version - a.version)[0];
      ensure(
        latest &&
          latest.input.kind === kind &&
          (kind !== 'financing' || latest.input.frequency === 'monthly'),
      );
    };
    data.financings.forEach((row) => link(row.planningSourceId, 'financing'));
    data.investments.forEach((row) => {
      if (row.planningSourceId) link(row.planningSourceId, 'investment');
    });
    unique(data.financingBalances, (row) => `${row.financingId}:${row.sequence}`);
    data.financingBalances.forEach((row) => {
      const parent = financing.get(row.financingId);
      ensure(parent && row.sequence <= parent.version);
      reportedDate(row.asOf, today);
    });
    unique(data.investmentEntries, (row) => `${row.investmentId}:${row.sequence}`);
    unique(
      data.investmentEntries.filter((row) => row.voidedAt === null),
      (row) => `${row.investmentId}:${row.orderSequence}`,
    );
    unique(data.investmentValuations, (row) => `${row.investmentId}:${row.sequence}`);
    data.investmentValuations.forEach((row) => {
      const parent = investments.get(row.investmentId);
      ensure(parent && row.sequence <= parent.version);
      reportedDate(row.asOf, today);
    });
    const entries = new Map(data.investmentEntries.map((row) => [row.id, row]));
    for (const row of data.investmentEntries) {
      const parent = investments.get(row.investmentId);
      ensure(parent && row.sequence <= parent.version);
      ensure((row.voidedAt === null) === (row.voidReason === null));
      ensure(row.kind === 'opening' ? row.orderSequence === 0 : row.orderSequence > 0);
      validateMovement(
        parent.mode,
        { ...row, amount: row.amountCents === null ? null : money(BigInt(row.amountCents)) },
        today,
      );
      if (row.replacesId !== null) {
        const previous = entries.get(row.replacesId);
        ensure(
          previous &&
            previous.investmentId === row.investmentId &&
            previous.voidedAt !== null &&
            previous.orderSequence === row.orderSequence &&
            previous.sequence < row.sequence &&
            (previous.kind === 'opening') === (row.kind === 'opening'),
        );
      }
    }
    for (const investment of data.investments)
      summarizeMovements(
        investment.mode,
        data.investmentEntries
          .filter((row) => row.investmentId === investment.id)
          .map((row) => ({
            ...row,
            amount: row.amountCents === null ? null : money(BigInt(row.amountCents)),
          })),
      );
    unique(data.monthlyPlans, (row) => row.month);
    unique(data.monthlyPlanRevisions, (row) => `${row.planId}:${row.number}`);
    const plans = new Map(data.monthlyPlans.map((row) => [row.id, row]));
    for (const row of data.monthlyPlanRevisions) {
      const plan = plans.get(row.planId);
      ensure(plan && row.snapshot.month === plan.month);
      ensure((row.state === 'closed') === (row.closedAt !== null));
      for (const line of row.snapshot.incomes) {
        ensure(line.id === `income:${line.sourceId}`);
        const input = incomeDefinitionSchema.parse(line.sourceInput);
        ensure(activeInMonth(input, plan.month));
        const calculated = calculateIncome(input);
        ensure(
          line.name === input.name &&
            line.kind === input.kind &&
            canonical(input.destination) ===
              canonical({
                accountId: line.destination.accountId,
                spaceId: line.destination.spaceId,
              }),
        );
        for (const key of [
          'expectedCash',
          'taxReserve',
          'base',
          'vat',
          'withholding',
          'commission',
        ] as const)
          ensure(canonical(line[key]) === canonical(calculated[key]));
      }
      for (const line of row.snapshot.charges) {
        ensure(line.id === `charge:${line.sourceId}`);
        const input = commitmentDefinitionSchema.parse(line.sourceInput);
        const projection = projectCommitment(input, plan.month);
        ensure(
          projection.active &&
            line.name === input.name &&
            line.kind === input.kind &&
            canonical(line.amount) === canonical(projection.monthlyCharge) &&
            canonical(line.duePayments) === canonical(projection.duePayments),
        );
        ensure(
          line.bucket ===
            (input.kind === 'investment'
              ? 'investment'
              : input.frequency === 'annual'
                ? 'provision'
                : 'cost'),
        );
        ensure(
          canonical(input.destination) ===
            canonical({ accountId: line.destination.accountId, spaceId: line.destination.spaceId }),
        );
      }
      ensure(canonical(calculatePlan(row.snapshot).summary) === canonical(row.summary));
      if (row.state === 'closed') assertClosable(row.snapshot, true);
      ensure(
        row.expectedCashCents === row.summary.expectedCash.minorUnits &&
          row.taxReserveCents === row.summary.taxReserve.minorUnits &&
          row.chargesCents === row.summary.planningCharges.minorUnits &&
          row.availabilityCents === row.summary.plannedAvailability.minorUnits &&
          row.allocatedCashCents === row.summary.allocatedCash.minorUnits &&
          row.fundingGapCents === row.summary.fundingGap.minorUnits,
      );
      const lines = [...row.snapshot.incomes, ...row.snapshot.charges];
      row.snapshot.overrides.forEach((item) =>
        ensure(
          lines.some((line) => line.id === item.lineId && sourceKind(line) === item.sourceKind),
        ),
      );
    }
    for (const plan of data.monthlyPlans) {
      const revisions = data.monthlyPlanRevisions
        .filter((row) => row.planId === plan.id)
        .sort((a, b) => a.number - b.number);
      ensure(revisions.length === plan.currentRevision);
      revisions.forEach((row, index) => {
        ensure(
          row.number === index + 1 && (index === 0 || row.version > revisions[index - 1]!.version),
        );
        if (row.number < plan.currentRevision) ensure(row.state === 'closed');
      });
      ensure(revisions.at(-1)?.version === plan.version);
    }
  } catch (error) {
    if (error instanceof DataFileError) throw error;
    throw new DataFileError('INVALID_DATA_FILE');
  }
}
