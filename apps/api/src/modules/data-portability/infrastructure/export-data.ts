import { Prisma } from '../../../generated/prisma/client.js';
import type { FinancialTransaction } from '../../../shared/infrastructure/financial-write.js';
import { DATA_FORMAT, DATA_VERSION, parseDocument } from '../application/document.js';
import type { FinancialDocument } from '../application/document.js';

function serialized(value: unknown, key = ''): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date)
    return ['startsOn', 'endsOn', 'date', 'asOf'].includes(key)
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toFixed();
  if (Array.isArray(value)) return value.map((item) => serialized(item));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, serialized(item, name)]),
    );
  return value;
}

export async function readExport(
  transaction: FinancialTransaction,
  userId: string,
): Promise<FinancialDocument> {
  const accounts = await transaction.account.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      institution: true,
      reference: true,
      currency: true,
      archivedFromMonth: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const spaces = await transaction.space.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true, accountId: true, name: true, archivedFromMonth: true, version: true },
  });
  const incomeSources = await transaction.incomeSource.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      recurrence: true,
      oneOffMonth: true,
      archivedFromMonth: true,
      version: true,
    },
  });
  const incomeRevisions = await transaction.incomeRevision.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      sourceId: true,
      version: true,
      name: true,
      effectiveFromMonth: true,
      startsOn: true,
      endsOn: true,
      accountId: true,
      spaceId: true,
      input: true,
      baseCents: true,
      vatCents: true,
      withholdingCents: true,
      commissionCents: true,
      cashCents: true,
      reserveCents: true,
      spendableCents: true,
      vatRate: true,
      withholdingRate: true,
      commissionRate: true,
      hourlyRate: true,
      hours: true,
      calculationVersion: true,
      createdAt: true,
    },
  });
  const commitmentSources = await transaction.commitmentSource.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true, archivedFromMonth: true, version: true },
  });
  const commitmentRevisions = await transaction.commitmentRevision.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      sourceId: true,
      version: true,
      name: true,
      effectiveFromMonth: true,
      startsOn: true,
      endsOn: true,
      accountId: true,
      spaceId: true,
      input: true,
      amountCents: true,
      calculationVersion: true,
      createdAt: true,
    },
  });
  const commitmentInstallments = await transaction.commitmentInstallment.findMany({
    where: { revision: { userId } },
    orderBy: [{ revisionId: 'asc' }, { ordinal: 'asc' }],
    select: { revisionId: true, ordinal: true, month: true, day: true, amountCents: true },
  });
  const financings = await transaction.financing.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      planningSourceId: true,
      name: true,
      lender: true,
      originalPrincipalCents: true,
      version: true,
      createdAt: true,
    },
  });
  const financingBalances = await transaction.financingBalance.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      financingId: true,
      sequence: true,
      asOf: true,
      amountCents: true,
      createdAt: true,
    },
  });
  const investments = await transaction.investment.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      planningSourceId: true,
      name: true,
      platform: true,
      ticker: true,
      kind: true,
      mode: true,
      version: true,
      createdAt: true,
    },
  });
  const investmentEntries = await transaction.investmentEntry.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      investmentId: true,
      sequence: true,
      orderSequence: true,
      date: true,
      kind: true,
      quantity: true,
      amountCents: true,
      note: true,
      replacesId: true,
      voidedAt: true,
      voidReason: true,
      createdAt: true,
    },
  });
  const investmentValuations = await transaction.investmentValuation.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      investmentId: true,
      sequence: true,
      asOf: true,
      amountCents: true,
      createdAt: true,
    },
  });
  const monthlyPlans = await transaction.monthlyPlan.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true, month: true, currentRevision: true, version: true, createdAt: true },
  });
  const monthlyPlanRevisions = await transaction.monthlyPlanRevision.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      planId: true,
      number: true,
      version: true,
      state: true,
      snapshot: true,
      summary: true,
      expectedCashCents: true,
      taxReserveCents: true,
      chargesCents: true,
      availabilityCents: true,
      allocatedCashCents: true,
      fundingGapCents: true,
      reopenReason: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true,
    },
  });
  const financialEvents = await transaction.financialEvent.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      payload: true,
      createdAt: true,
    },
  });
  return parseDocument(
    serialized({
      format: DATA_FORMAT,
      formatVersion: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      currency: 'EUR',
      moneyEncoding: 'integer-cents-as-strings',
      data: {
        accounts,
        spaces,
        incomeSources,
        incomeRevisions,
        commitmentSources,
        commitmentRevisions,
        commitmentInstallments,
        financings,
        financingBalances,
        investments,
        investmentEntries,
        investmentValuations,
        monthlyPlans,
        monthlyPlanRevisions,
        financialEvents,
      },
    }),
  );
}
