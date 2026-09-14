import type { Prisma } from '../../generated/prisma/client.js';
import type { DatabaseService } from '../database.service.js';
import { FinancialError } from '../domain/financial-error.js';
import type { Destination, EffectivePeriod } from '../domain/calendar.js';
import type { DestinationUsage } from '../application/destination-usage.js';

export type FinancialTransaction = Prisma.TransactionClient;
export function jsonInput(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
export const sqlDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
export const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

export async function financialWrite<T>(
  database: DatabaseService,
  userId: string,
  operation: (transaction: FinancialTransaction) => Promise<T>,
  timeout = 10_000,
): Promise<T> {
  return database.client.$transaction(
    async (transaction) => {
      const users = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      if (users.length !== 1) throw new FinancialError('DESTINATION_NOT_FOUND');
      return operation(transaction);
    },
    { maxWait: 10_000, timeout },
  );
}

export async function financialEvent(
  transaction: FinancialTransaction,
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  payload: object,
): Promise<void> {
  await transaction.financialEvent.create({
    data: { userId, entityType, entityId, action, payload: jsonInput(payload) },
  });
}

export async function assertDestination(
  transaction: FinancialTransaction,
  userId: string,
  destination: Destination,
  period: EffectivePeriod,
  boundedMonth: string | null = null,
): Promise<void> {
  const account = await transaction.account.findFirst({
    where: { id: destination.accountId, userId },
  });
  if (!account) throw new FinancialError('DESTINATION_NOT_FOUND');
  const space = destination.spaceId
    ? await transaction.space.findFirst({
        where: { id: destination.spaceId, accountId: account.id, userId },
      })
    : null;
  if (destination.spaceId && !space) throw new FinancialError('DESTINATION_NOT_FOUND');
  const end = boundedMonth ?? period.endsOn?.slice(0, 7) ?? null;
  for (const archive of [account.archivedFromMonth, space?.archivedFromMonth ?? null]) {
    if (archive && (end === null || archive <= end))
      throw new FinancialError('DESTINATION_UNAVAILABLE');
  }
}

interface ReferenceRevision {
  id: string;
  version: number;
  name: string;
  effectiveFromMonth: string;
  startsOn: Date;
  endsOn: Date | null;
  accountId: string;
  spaceId: string | null;
}

export async function destinationUsage(
  transaction: FinancialTransaction,
  userId: string,
  accountId: string,
  spaceId: string | null,
  fromMonth: string,
): Promise<DestinationUsage[]> {
  const select = {
    id: true,
    version: true,
    name: true,
    effectiveFromMonth: true,
    startsOn: true,
    endsOn: true,
    accountId: true,
    spaceId: true,
  } as const;
  const target = { accountId, ...(spaceId ? { spaceId } : {}) };
  const incomes = await transaction.incomeSource.findMany({
    where: { userId, revisions: { some: target } },
    include: { revisions: { select, orderBy: { version: 'asc' } } },
  });
  const commitments = await transaction.commitmentSource.findMany({
    where: { userId, revisions: { some: target } },
    include: { revisions: { select, orderBy: { version: 'asc' } } },
  });
  const used = (
    source: { archivedFromMonth: string | null; revisions: ReferenceRevision[] },
    oneOffMonth: string | null,
  ) => {
    const latestByMonth = new Map<string, ReferenceRevision>();
    source.revisions.forEach((revision) =>
      latestByMonth.set(revision.effectiveFromMonth, revision),
    );
    const revisions = [...latestByMonth.values()].sort((a, b) =>
      a.effectiveFromMonth.localeCompare(b.effectiveFromMonth),
    );
    return revisions.find((revision, index) => {
      if (revision.accountId !== accountId || (spaceId !== null && revision.spaceId !== spaceId))
        return false;
      const start =
        [fromMonth, revision.effectiveFromMonth, calendarDate(revision.startsOn).slice(0, 7)]
          .sort()
          .at(-1) ?? fromMonth;
      if (source.archivedFromMonth && start >= source.archivedFromMonth) return false;
      const next = revisions[index + 1];
      if (next && start >= next.effectiveFromMonth) return false;
      if (revision.endsOn && start > calendarDate(revision.endsOn).slice(0, 7)) return false;
      return oneOffMonth === null || start <= oneOffMonth;
    });
  };
  const result: DestinationUsage[] = [];
  for (const source of incomes) {
    const revision = used(source, source.oneOffMonth);
    if (revision) result.push({ id: source.id, kind: 'income', name: revision.name });
  }
  for (const source of commitments) {
    const revision = used(source, null);
    if (revision) result.push({ id: source.id, kind: 'commitment', name: revision.name });
  }
  return result;
}
