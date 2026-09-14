import { Inject, Injectable } from '@nestjs/common';
import type { IncomeRevision, IncomeSource } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../shared/database.service.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';
import { activeInMonth } from '../../../shared/domain/calendar.js';
import { boundedEndMonth } from '../../../shared/domain/source-period.js';
import { money } from '../../../shared/domain/money.js';
import { incomeDefinitionSchema } from '../../../shared/application/financial-input.js';
import type { ListInput, SourceListInput } from '../../../shared/application/financial-input.js';
import {
  assertDestination,
  financialEvent,
  financialWrite,
  jsonInput,
  sqlDate,
} from '../../../shared/infrastructure/financial-write.js';
import type { IncomeCalculation, IncomeDefinition } from '../domain/income.js';
import type {
  IncomeDetail,
  IncomeRecord,
  IncomeRevisionRecord,
  IncomeStore,
} from '../application/income.port.js';

type StoredSource = IncomeSource & { revisions: IncomeRevision[] };
function revisionRecord(revision: IncomeRevision): IncomeRevisionRecord {
  if (revision.calculationVersion !== 'income-v1')
    throw new Error('Unsupported income calculation version');
  return {
    id: revision.id,
    version: revision.version,
    input: incomeDefinitionSchema.parse(revision.input),
    createdAt: revision.createdAt.toISOString(),
    calculation: {
      base: money(revision.baseCents),
      vat: money(revision.vatCents),
      withholding: money(revision.withholdingCents),
      commission: money(revision.commissionCents),
      expectedCash: money(revision.cashCents),
      taxReserve: money(revision.reserveCents),
      spendableIncome: money(revision.spendableCents),
    },
  };
}
function sourceRecord(source: StoredSource, month: string, latest = false): IncomeRecord {
  const selected =
    (latest ? undefined : source.revisions.find((item) => item.effectiveFromMonth <= month)) ??
    source.revisions[0];
  if (!selected) throw new Error('Missing income revision');
  const revision = revisionRecord(selected);
  const active =
    activeInMonth(revision.input, month) &&
    (!source.archivedFromMonth || month < source.archivedFromMonth) &&
    (!source.oneOffMonth || source.oneOffMonth === month);
  return {
    id: source.id,
    version: source.version,
    archivedFromMonth: source.archivedFromMonth,
    recurrence: source.recurrence === 'once' ? 'once' : 'monthly',
    oneOffMonth: source.oneOffMonth,
    revision,
    active,
    calculation: active
      ? revision.calculation
      : {
          base: money(0n),
          vat: money(0n),
          withholding: money(0n),
          commission: money(0n),
          expectedCash: money(0n),
          taxReserve: money(0n),
          spendableIncome: money(0n),
        },
  };
}
const revisionOrder = [{ effectiveFromMonth: 'desc' }, { version: 'desc' }] as const;
function revisionData(
  userId: string,
  input: IncomeDefinition,
  calculation: IncomeCalculation,
  version: number,
) {
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
    baseCents: BigInt(calculation.base.minorUnits),
    vatCents: BigInt(calculation.vat.minorUnits),
    withholdingCents: BigInt(calculation.withholding.minorUnits),
    commissionCents: BigInt(calculation.commission.minorUnits),
    cashCents: BigInt(calculation.expectedCash.minorUnits),
    reserveCents: BigInt(calculation.taxReserve.minorUnits),
    spendableCents: BigInt(calculation.spendableIncome.minorUnits),
    vatRate: input.vatRate,
    withholdingRate: input.withholdingRate,
    commissionRate: input.commissionRate,
    hourlyRate: input.hourlyRate,
    hours: input.hours,
  };
}

@Injectable()
export class PrismaIncomeStore implements IncomeStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async list(
    userId: string,
    input: SourceListInput,
    month: string,
    recurrence: 'monthly' | 'once',
  ) {
    const where = {
      userId,
      recurrence,
      ...(recurrence === 'once' ? { oneOffMonth: month } : {}),
      ...(input.q
        ? { revisions: { some: { name: { contains: input.q, mode: 'insensitive' as const } } } }
        : {}),
      ...(!input.includeArchived
        ? { OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] }
        : {}),
    };
    const sources = await this.database.client.incomeSource.findMany({
      where,
      orderBy: { id: 'asc' },
      include: { revisions: { orderBy: [...revisionOrder] } },
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
  async detail(userId: string, id: string, input: ListInput, month: string): Promise<IncomeDetail> {
    const source = await this.database.client.incomeSource.findFirst({
      where: { id, userId },
      include: { revisions: { orderBy: [...revisionOrder] } },
    });
    if (!source) throw new FinancialError('INCOME_SOURCE_NOT_FOUND');
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
  create(
    userId: string,
    input: IncomeDefinition,
    calculation: IncomeCalculation,
    recurrence: 'monthly' | 'once',
    month: string,
  ): Promise<IncomeRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const oneOffMonth = recurrence === 'once' ? input.effectiveFromMonth : null;
      await assertDestination(
        transaction,
        userId,
        input.destination,
        input,
        boundedEndMonth(input, null, oneOffMonth),
      );
      const source = await transaction.incomeSource.create({
        data: { userId, recurrence, oneOffMonth },
      });
      const revision = await transaction.incomeRevision.create({
        data: { sourceId: source.id, ...revisionData(userId, input, calculation, 1) },
      });
      await financialEvent(transaction, userId, 'income', source.id, 'created', {
        revisionId: revision.id,
        version: 1,
      });
      return sourceRecord({ ...source, revisions: [revision] }, month, true);
    });
  }
  revise(
    userId: string,
    id: string,
    input: IncomeDefinition,
    calculation: IncomeCalculation,
    expectedVersion: number,
    month: string,
    recurrence: 'monthly' | 'once',
  ): Promise<IncomeRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const source = await transaction.incomeSource.findFirst({
        where: { id, userId, recurrence },
        include: { revisions: { orderBy: [...revisionOrder], take: 1 } },
      });
      if (!source) throw new FinancialError('INCOME_SOURCE_NOT_FOUND');
      if (source.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (source.archivedFromMonth && input.effectiveFromMonth >= source.archivedFromMonth)
        throw new FinancialError('RESOURCE_ARCHIVED');
      if (
        (source.oneOffMonth && input.effectiveFromMonth !== source.oneOffMonth) ||
        (source.revisions[0] && input.effectiveFromMonth < source.revisions[0].effectiveFromMonth)
      )
        throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
      await assertDestination(
        transaction,
        userId,
        input.destination,
        input,
        boundedEndMonth(input, source.archivedFromMonth, source.oneOffMonth),
      );
      const updated = await transaction.incomeSource.update({
        where: { id, userId },
        data: { version: { increment: 1 } },
      });
      const revision = await transaction.incomeRevision.create({
        data: { sourceId: id, ...revisionData(userId, input, calculation, updated.version) },
      });
      await financialEvent(transaction, userId, 'income', id, 'revised', {
        revisionId: revision.id,
        version: updated.version,
      });
      return sourceRecord({ ...updated, revisions: [revision] }, month, true);
    });
  }
  archive(userId: string, id: string, month: string, expectedVersion: number): Promise<void> {
    return financialWrite(this.database, userId, async (transaction) => {
      const source = await transaction.incomeSource.findFirst({ where: { id, userId } });
      if (!source) throw new FinancialError('INCOME_SOURCE_NOT_FOUND');
      if (source.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (source.archivedFromMonth) throw new FinancialError('RESOURCE_ARCHIVED');
      await transaction.incomeSource.update({
        where: { id, userId },
        data: { archivedFromMonth: month, version: { increment: 1 } },
      });
      await financialEvent(transaction, userId, 'income', id, 'archived', {
        month,
        expectedVersion,
      });
    });
  }
}
