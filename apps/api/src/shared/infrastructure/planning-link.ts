import type { FinancialTransaction } from './financial-write.js';
import { assertDestination, financialEvent, jsonInput, sqlDate } from './financial-write.js';
import type { LinkedPlan, PlanningLinkInput } from '../application/planning-link.js';
import { commitmentDefinitionSchema } from '../application/financial-input.js';
import { FinancialError } from '../domain/financial-error.js';
import { money } from '../domain/money.js';
import {
  projectCommitment,
  validateCommitment,
} from '../../modules/commitments/domain/commitment.js';

export async function linkedPlan(
  transaction: FinancialTransaction,
  userId: string,
  id: string,
  month: string,
): Promise<LinkedPlan> {
  const source = await transaction.commitmentSource.findFirst({
    where: { id, userId },
    include: {
      revisions: { orderBy: [{ effectiveFromMonth: 'desc' }, { version: 'desc' }], take: 1 },
    },
  });
  const revision = source?.revisions[0];
  if (!source || !revision) throw new FinancialError('COMMITMENT_NOT_FOUND');
  const definition = commitmentDefinitionSchema.parse(revision.input);
  const projection = projectCommitment(definition, month);
  const active =
    projection.active && (!source.archivedFromMonth || month < source.archivedFromMonth);
  return {
    id,
    version: source.version,
    definition,
    archivedFromMonth: source.archivedFromMonth,
    active,
    monthlyCharge: active ? projection.monthlyCharge : money(0n),
  };
}

// Transaction-bound planning integration: caller retains the existing per-user write lock.
export async function createPlanningLink(
  transaction: FinancialTransaction,
  userId: string,
  kind: 'financing' | 'investment',
  input: PlanningLinkInput,
  month: string,
): Promise<LinkedPlan> {
  if (input.sourceId) {
    if (input.definition !== null || input.expectedVersion === null)
      throw new FinancialError('INVALID_FINANCIAL_INPUT');
    const source = await linkedPlan(transaction, userId, input.sourceId, month);
    if (source.version !== input.expectedVersion) throw new FinancialError('VERSION_CONFLICT');
    if (
      source.archivedFromMonth ||
      source.definition.kind !== kind ||
      (kind === 'financing' && source.definition.frequency !== 'monthly')
    )
      throw new FinancialError('INVALID_PLANNING_LINK');
    const occupied =
      (await transaction.financing.findFirst({
        where: { planningSourceId: source.id },
        select: { id: true },
      })) ??
      (await transaction.investment.findFirst({
        where: { planningSourceId: source.id },
        select: { id: true },
      }));
    if (occupied) throw new FinancialError('PLANNING_SOURCE_LINKED');
    return source;
  }
  if (
    !input.definition ||
    input.expectedVersion !== null ||
    input.definition.kind !== kind ||
    (kind === 'financing' && input.definition.frequency !== 'monthly')
  )
    throw new FinancialError('INVALID_PLANNING_LINK');
  const definition = input.definition;
  validateCommitment(definition);
  await assertDestination(transaction, userId, definition.destination, definition);
  const source = await transaction.commitmentSource.create({ data: { userId } });
  const revision = await transaction.commitmentRevision.create({
    data: {
      sourceId: source.id,
      userId,
      version: 1,
      name: definition.name,
      effectiveFromMonth: definition.effectiveFromMonth,
      startsOn: sqlDate(definition.startsOn),
      endsOn: definition.endsOn ? sqlDate(definition.endsOn) : null,
      accountId: definition.destination.accountId,
      spaceId: definition.destination.spaceId,
      input: jsonInput(definition),
      amountCents: BigInt(definition.amount.minorUnits),
      installments: {
        create: definition.installments.map((item, ordinal) => ({
          ordinal,
          month: item.month,
          day: item.day,
          amountCents: BigInt(item.amount.minorUnits),
        })),
      },
    },
  });
  await financialEvent(transaction, userId, 'commitment', source.id, 'created', {
    revisionId: revision.id,
    version: 1,
    linkedKind: kind,
  });
  return linkedPlan(transaction, userId, source.id, month);
}
