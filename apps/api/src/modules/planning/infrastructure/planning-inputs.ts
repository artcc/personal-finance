import { createHash } from 'node:crypto';
import type { FinancialTransaction } from '../../../shared/infrastructure/financial-write.js';
import {
  incomeDefinitionSchema,
  commitmentDefinitionSchema,
} from '../../../shared/application/financial-input.js';
import { activeInMonth } from '../../../shared/domain/calendar.js';
import { money } from '../../../shared/domain/money.js';
import { projectCommitment } from '../../commitments/domain/commitment.js';
import { PlanError } from '../domain/plan.js';
import type { IncomeLine, ChargeLine, PlanDestination, PlanInputs } from '../domain/plan.js';

export async function readPlanDestinations(
  transaction: FinancialTransaction,
  userId: string,
  month: string,
): Promise<PlanDestination[]> {
  const accounts = await transaction.account.findMany({
    where: { userId, OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] },
    orderBy: { id: 'asc' },
    include: {
      spaces: {
        where: { userId, OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] },
        orderBy: { id: 'asc' },
      },
    },
  });
  const destinations: PlanDestination[] = accounts.flatMap((account) => {
    const direct: PlanDestination = {
      accountId: account.id,
      accountName: account.name,
      institution: account.institution,
      reference: account.reference,
      spaceId: null,
      spaceName: null,
    };
    return [
      direct,
      ...account.spaces.map((space) => ({ ...direct, spaceId: space.id, spaceName: space.name })),
    ];
  });
  return destinations;
}

export async function readPlanningInputs(
  transaction: FinancialTransaction,
  userId: string,
  month: string,
): Promise<PlanInputs> {
  const destinations = await readPlanDestinations(transaction, userId, month);
  const destination = (accountId: string, spaceId: string | null) => {
    const found = destinations.find(
      (item) => item.accountId === accountId && item.spaceId === spaceId,
    );
    if (!found) throw new PlanError('INVALID_PLANNING_SOURCE');
    return found;
  };
  const revisionSelection = {
    where: { effectiveFromMonth: { lte: month } },
    orderBy: [{ effectiveFromMonth: 'desc' as const }, { version: 'desc' as const }],
    take: 1,
  };
  const incomeSources = await transaction.incomeSource.findMany({
    where: {
      userId,
      AND: [
        { OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] },
        { OR: [{ recurrence: 'monthly' }, { recurrence: 'once', oneOffMonth: month }] },
      ],
    },
    orderBy: { id: 'asc' },
    include: { revisions: revisionSelection },
  });
  const commitmentSources = await transaction.commitmentSource.findMany({
    where: { userId, OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] },
    orderBy: { id: 'asc' },
    include: { revisions: revisionSelection },
  });
  const incomes: IncomeLine[] = [];
  const charges: ChargeLine[] = [];
  for (const source of incomeSources) {
    const revision = source.revisions[0];
    if (!revision) continue;
    const input = incomeDefinitionSchema.parse(revision.input);
    if (!activeInMonth(input, month)) continue;
    if (revision.calculationVersion !== 'income-v1') throw new PlanError('INVALID_PLANNING_SOURCE');
    incomes.push({
      id: `income:${source.id}`,
      sourceId: source.id,
      sourceRevisionId: revision.id,
      sourceVersion: revision.version,
      name: revision.name,
      kind: input.kind,
      sourceInput: input,
      destination: destination(revision.accountId, revision.spaceId),
      expectedCash: money(revision.cashCents),
      taxReserve: money(revision.reserveCents),
      base: money(revision.baseCents),
      vat: money(revision.vatCents),
      withholding: money(revision.withholdingCents),
      commission: money(revision.commissionCents),
    });
  }
  for (const source of commitmentSources) {
    const revision = source.revisions[0];
    if (!revision) continue;
    const input = commitmentDefinitionSchema.parse(revision.input);
    if (revision.calculationVersion !== 'commitment-v1')
      throw new PlanError('INVALID_PLANNING_SOURCE');
    const projection = projectCommitment(input, month);
    if (!projection.active) continue;
    charges.push({
      id: `charge:${source.id}`,
      sourceId: source.id,
      sourceRevisionId: revision.id,
      sourceVersion: revision.version,
      name: revision.name,
      kind: input.kind,
      sourceInput: input,
      destination: destination(revision.accountId, revision.spaceId),
      bucket:
        input.kind === 'investment'
          ? 'investment'
          : input.frequency === 'annual'
            ? 'provision'
            : 'cost',
      amount: projection.monthlyCharge,
      duePayments: projection.duePayments,
    });
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ incomes, charges, destinations }))
    .digest('hex');
  return { incomes, charges, destinations, fingerprint };
}
