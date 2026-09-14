import { Inject, Injectable } from '@nestjs/common';
import type { CommitmentRevision, CommitmentSource } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../shared/database.service.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';
import { boundedEndMonth } from '../../../shared/domain/source-period.js';
import { money } from '../../../shared/domain/money.js';
import { commitmentDefinitionSchema } from '../../../shared/application/financial-input.js';
import type { ListInput, SourceListInput } from '../../../shared/application/financial-input.js';
import {
  assertDestination,
  financialEvent,
  financialWrite,
  jsonInput,
  sqlDate,
} from '../../../shared/infrastructure/financial-write.js';
import { projectCommitment } from '../domain/commitment.js';
import type { CommitmentDefinition } from '../domain/commitment.js';
import type {
  CommitmentDetail,
  CommitmentRecord,
  CommitmentRevisionRecord,
  CommitmentsStore,
} from '../application/commitments.port.js';

type StoredSource = CommitmentSource & {
  revisions: CommitmentRevision[];
  financing?: { id: string } | null;
  investment?: { id: string } | null;
};
const revisionOrder = [{ effectiveFromMonth: 'desc' }, { version: 'desc' }] as const;
function revisionRecord(revision: CommitmentRevision): CommitmentRevisionRecord {
  if (revision.calculationVersion !== 'commitment-v1')
    throw new Error('Unsupported commitment calculation version');
  return {
    id: revision.id,
    version: revision.version,
    input: commitmentDefinitionSchema.parse(revision.input),
    createdAt: revision.createdAt.toISOString(),
  };
}
function sourceRecord(source: StoredSource, month: string, latest = false): CommitmentRecord {
  const selected =
    (latest ? undefined : source.revisions.find((item) => item.effectiveFromMonth <= month)) ??
    source.revisions[0];
  if (!selected) throw new Error('Missing commitment revision');
  const revision = revisionRecord(selected);
  return {
    id: source.id,
    managedKind: source.financing ? 'financing' : source.investment ? 'investment' : null,
    version: source.version,
    archivedFromMonth: source.archivedFromMonth,
    revision,
    projection:
      source.archivedFromMonth && month >= source.archivedFromMonth
        ? { active: false, monthlyCharge: money(0n), duePayments: [] }
        : projectCommitment(revision.input, month),
  };
}
function revisionData(userId: string, input: CommitmentDefinition, version: number) {
  return {
    userId,
    version,
    name: input.name,
    effectiveFromMonth: input.effectiveFromMonth,
    startsOn: sqlDate(input.startsOn),
    endsOn: input.endsOn ? sqlDate(input.endsOn) : null,
    accountId: input.destination.accountId,
    spaceId: input.destination.spaceId,
    input: jsonInput(input),
    amountCents: BigInt(input.amount.minorUnits),
    installments: {
      create: input.installments.map((item, ordinal) => ({
        ordinal,
        month: item.month,
        day: item.day,
        amountCents: BigInt(item.amount.minorUnits),
      })),
    },
  };
}

@Injectable()
export class PrismaCommitmentsStore implements CommitmentsStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async list(userId: string, input: SourceListInput, month: string) {
    const where = {
      userId,
      ...(input.q
        ? { revisions: { some: { name: { contains: input.q, mode: 'insensitive' as const } } } }
        : {}),
      ...(!input.includeArchived
        ? { OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] }
        : {}),
    };
    const sources = await this.database.client.commitmentSource.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        revisions: { orderBy: [...revisionOrder] },
        financing: { select: { id: true } },
        investment: { select: { id: true } },
      },
    });
    const records = sources
      .map((source) => sourceRecord(source, month))
      .filter(
        (record) =>
          record.revision.input.name.toLowerCase().includes(input.q.toLowerCase()) &&
          (input.kind === 'all' || record.revision.input.kind === input.kind) &&
          (!input.accountId || record.revision.input.destination.accountId === input.accountId),
      );
    return {
      items: records.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
      total: records.length,
    };
  }
  async detail(
    userId: string,
    id: string,
    input: ListInput,
    month: string,
  ): Promise<CommitmentDetail> {
    const source = await this.database.client.commitmentSource.findFirst({
      where: { id, userId },
      include: {
        revisions: { orderBy: [...revisionOrder] },
        financing: { select: { id: true } },
        investment: { select: { id: true } },
      },
    });
    if (!source) throw new FinancialError('COMMITMENT_NOT_FOUND');
    return {
      current: sourceRecord(source, month, true),
      history: source.revisions
        .slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
        .map(revisionRecord),
      page: input.page,
      pageSize: input.pageSize,
      total: source.revisions.length,
      month,
    };
  }
  create(userId: string, input: CommitmentDefinition, month: string): Promise<CommitmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      await assertDestination(transaction, userId, input.destination, input);
      const source = await transaction.commitmentSource.create({ data: { userId } });
      const revision = await transaction.commitmentRevision.create({
        data: { sourceId: source.id, ...revisionData(userId, input, 1) },
      });
      await financialEvent(transaction, userId, 'commitment', source.id, 'created', {
        revisionId: revision.id,
        version: 1,
      });
      return sourceRecord({ ...source, revisions: [revision] }, month, true);
    });
  }
  revise(
    userId: string,
    id: string,
    input: CommitmentDefinition,
    expectedVersion: number,
    month: string,
  ): Promise<CommitmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const source = await transaction.commitmentSource.findFirst({
        where: { id, userId },
        include: {
          revisions: { orderBy: [...revisionOrder], take: 1 },
          financing: { select: { id: true } },
          investment: { select: { id: true } },
        },
      });
      if (!source) throw new FinancialError('COMMITMENT_NOT_FOUND');
      if (source.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (
        (source.financing && (input.kind !== 'financing' || input.frequency !== 'monthly')) ||
        (source.investment && input.kind !== 'investment')
      )
        throw new FinancialError('LINKED_SOURCE_KIND_MISMATCH');
      if (source.archivedFromMonth && input.effectiveFromMonth >= source.archivedFromMonth)
        throw new FinancialError('RESOURCE_ARCHIVED');
      if (source.revisions[0] && input.effectiveFromMonth < source.revisions[0].effectiveFromMonth)
        throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
      await assertDestination(
        transaction,
        userId,
        input.destination,
        input,
        boundedEndMonth(input, source.archivedFromMonth),
      );
      const updated = await transaction.commitmentSource.update({
        where: { id, userId },
        data: { version: { increment: 1 } },
      });
      const revision = await transaction.commitmentRevision.create({
        data: { sourceId: id, ...revisionData(userId, input, updated.version) },
      });
      await financialEvent(transaction, userId, 'commitment', id, 'revised', {
        revisionId: revision.id,
        version: updated.version,
      });
      return sourceRecord(
        {
          ...updated,
          revisions: [revision],
          financing: source.financing,
          investment: source.investment,
        },
        month,
        true,
      );
    });
  }
  archive(userId: string, id: string, month: string, expectedVersion: number): Promise<void> {
    return financialWrite(this.database, userId, async (transaction) => {
      const source = await transaction.commitmentSource.findFirst({ where: { id, userId } });
      if (!source) throw new FinancialError('COMMITMENT_NOT_FOUND');
      if (source.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (source.archivedFromMonth) throw new FinancialError('RESOURCE_ARCHIVED');
      await transaction.commitmentSource.update({
        where: { id, userId },
        data: { archivedFromMonth: month, version: { increment: 1 } },
      });
      await financialEvent(transaction, userId, 'commitment', id, 'archived', {
        month,
        expectedVersion,
      });
    });
  }
}
