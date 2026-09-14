import { Inject, Injectable } from '@nestjs/common';
import type { Investment, InvestmentEntry } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../shared/database.service.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';
import { money } from '../../../shared/domain/money.js';
import type { Money } from '../../../shared/domain/money.js';
import {
  financialWrite,
  financialEvent,
  calendarDate,
  sqlDate,
} from '../../../shared/infrastructure/financial-write.js';
import type { FinancialTransaction } from '../../../shared/infrastructure/financial-write.js';
import { createPlanningLink, linkedPlan } from '../../../shared/infrastructure/planning-link.js';
import type { PlanningLinkInput } from '../../../shared/application/planning-link.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import {
  investmentMetadataSchema,
  movementSchema,
} from '../../../shared/application/asset-input.js';
import { InvestmentError, summarizeMovements, validateMovement } from '../domain/movements.js';
import type { InvestmentMode, Movement, MovementInput } from '../domain/movements.js';
import type {
  InvestmentMetadata,
  InvestmentRecord,
  InvestmentsStore,
} from '../application/investments.port.js';

function movement(row: InvestmentEntry): Movement {
  const input = movementSchema.parse({
    date: calendarDate(row.date),
    kind: row.kind,
    quantity: row.quantity?.toFixed(8) ?? null,
    amount: row.amountCents === null ? null : money(row.amountCents),
    note: row.note,
  });
  return {
    ...input,
    id: row.id,
    sequence: row.sequence,
    orderSequence: row.orderSequence,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
    replacesId: row.replacesId,
  };
}
async function owned(transaction: FinancialTransaction, userId: string, id: string) {
  const row = await transaction.investment.findFirst({ where: { id, userId } });
  if (!row) throw new FinancialError('INVESTMENT_NOT_FOUND');
  return row;
}
async function record(
  transaction: FinancialTransaction,
  row: Investment,
  month: string,
): Promise<InvestmentRecord> {
  const entries = await transaction.investmentEntry.findMany({
    where: { investmentId: row.id, userId: row.userId, voidedAt: null },
  });
  const mode = row.mode === 'units' ? 'units' : 'contributions';
  const summary = summarizeMovements(mode, entries.map(movement));
  const value = await transaction.investmentValuation.findFirst({
    where: { investmentId: row.id, userId: row.userId },
    orderBy: [{ asOf: 'desc' }, { sequence: 'desc' }],
  });
  const latestValuation = value
    ? { id: value.id, asOf: calendarDate(value.asOf), amount: money(value.amountCents) }
    : null;
  return {
    ...investmentMetadataSchema.parse({
      name: row.name,
      platform: row.platform,
      ticker: row.ticker,
      kind: row.kind,
    }),
    id: row.id,
    version: row.version,
    mode,
    summary,
    latestValuation,
    valuationStale: Boolean(
      latestValuation &&
      summary.lastMovementDate &&
      latestValuation.asOf < summary.lastMovementDate,
    ),
    planning: row.planningSourceId
      ? await linkedPlan(transaction, row.userId, row.planningSourceId, month)
      : null,
  };
}

@Injectable()
export class PrismaInvestmentsStore implements InvestmentsStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async list(userId: string, query: ListInput, month: string) {
    const where = {
      userId,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { platform: { contains: query.q, mode: 'insensitive' as const } },
              { ticker: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return this.database.client.$transaction(
      async (transaction) => {
        const rows = await transaction.investment.findMany({
          where,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          items: await Promise.all(rows.map((row) => record(transaction, row, month))),
          total: await transaction.investment.count({ where }),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 10000 },
    );
  }
  detail(userId: string, id: string, month: string): Promise<InvestmentRecord> {
    return this.database.client.$transaction(
      async (transaction) => record(transaction, await owned(transaction, userId, id), month),
      { isolationLevel: 'RepeatableRead' },
    );
  }
  create(
    userId: string,
    input: InvestmentMetadata & { mode: InvestmentMode; planning: PlanningLinkInput | null },
    month: string,
  ): Promise<InvestmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const link = input.planning
        ? await createPlanningLink(transaction, userId, 'investment', input.planning, month)
        : null;
      const row = await transaction.investment.create({
        data: {
          userId,
          name: input.name,
          platform: input.platform,
          ticker: input.ticker,
          kind: input.kind,
          mode: input.mode,
          planningSourceId: link?.id ?? null,
        },
      });
      await financialEvent(transaction, userId, 'investment', row.id, 'created', {
        planningSourceId: row.planningSourceId,
        mode: row.mode,
      });
      return record(transaction, row, month);
    });
  }
  update(
    userId: string,
    id: string,
    input: InvestmentMetadata & { planning: PlanningLinkInput | null },
    expectedVersion: number,
    month: string,
  ): Promise<InvestmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await owned(transaction, userId, id);
      if (previous.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (input.planning && previous.planningSourceId)
        throw new FinancialError('PLANNING_SOURCE_LINKED');
      const link = input.planning
        ? await createPlanningLink(transaction, userId, 'investment', input.planning, month)
        : null;
      const row = await transaction.investment.update({
        where: { id, userId },
        data: {
          name: input.name,
          platform: input.platform,
          ticker: input.ticker,
          kind: input.kind,
          ...(link ? { planningSourceId: link.id } : {}),
          version: { increment: 1 },
        },
      });
      await financialEvent(transaction, userId, 'investment', id, 'updated', {
        before: {
          name: previous.name,
          platform: previous.platform,
          ticker: previous.ticker,
          kind: previous.kind,
        },
        after: { name: row.name, platform: row.platform, ticker: row.ticker, kind: row.kind },
        planningSourceId: row.planningSourceId,
      });
      return record(transaction, row, month);
    });
  }
  async entries(userId: string, id: string, query: ListInput) {
    await owned(this.database.client, userId, id);
    const where = { userId, investmentId: id };
    const [rows, total] = await this.database.client.$transaction([
      this.database.client.investmentEntry.findMany({
        where,
        orderBy: [{ date: 'desc' }, { sequence: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.investmentEntry.count({ where }),
    ]);
    return { items: rows.map(movement), total };
  }
  writeEntry(
    userId: string,
    id: string,
    expectedVersion: number,
    input: MovementInput,
    previousId: string | null,
    reason: string | null,
    today: string,
    month: string,
  ): Promise<InvestmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const investment = await owned(transaction, userId, id);
      if (investment.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      validateMovement(investment.mode === 'units' ? 'units' : 'contributions', input, today);
      if (input.kind === 'opening') {
        const existingOpening = await transaction.investmentEntry.findFirst({
          where: { userId, investmentId: id, kind: 'opening', voidedAt: null },
          select: { id: true },
        });
        if (existingOpening && existingOpening.id !== previousId)
          throw new InvestmentError('INVALID_OPENING_RECORD');
      }
      let orderSequence = input.kind === 'opening' ? 0 : investment.version + 1;
      if (previousId) {
        const previous = await transaction.investmentEntry.findFirst({
          where: { id: previousId, investmentId: id, userId, voidedAt: null },
        });
        if (!previous) throw new FinancialError('INVESTMENT_ENTRY_NOT_FOUND');
        if (!reason?.trim()) throw new FinancialError('INVALID_FINANCIAL_INPUT');
        if ((previous.kind === 'opening') !== (input.kind === 'opening'))
          throw new FinancialError('INVALID_FINANCIAL_INPUT');
        orderSequence = previous.orderSequence;
        await transaction.investmentEntry.update({
          where: { id: previousId, userId },
          data: { voidedAt: new Date(), voidReason: reason.trim() },
        });
      }
      const row = await transaction.investment.update({
        where: { id, userId },
        data: { version: { increment: 1 } },
      });
      const entry = await transaction.investmentEntry.create({
        data: {
          userId,
          investmentId: id,
          sequence: row.version,
          orderSequence,
          date: sqlDate(input.date),
          kind: input.kind,
          quantity: input.quantity,
          amountCents: input.amount ? BigInt(input.amount.minorUnits) : null,
          note: input.note,
          replacesId: previousId,
        },
      });
      const result = await record(transaction, row, month);
      await financialEvent(
        transaction,
        userId,
        'investment',
        id,
        previousId ? 'movement-corrected' : 'movement-recorded',
        { entryId: entry.id, previousId, reason },
      );
      return result;
    });
  }
  voidEntry(
    userId: string,
    id: string,
    entryId: string,
    expectedVersion: number,
    reason: string,
    month: string,
  ): Promise<InvestmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await owned(transaction, userId, id);
      if (previous.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (!reason.trim()) throw new FinancialError('INVALID_FINANCIAL_INPUT');
      const entry = await transaction.investmentEntry.findFirst({
        where: { id: entryId, investmentId: id, userId, voidedAt: null },
      });
      if (!entry) throw new FinancialError('INVESTMENT_ENTRY_NOT_FOUND');
      await transaction.investmentEntry.update({
        where: { id: entryId, userId },
        data: { voidedAt: new Date(), voidReason: reason.trim() },
      });
      const row = await transaction.investment.update({
        where: { id, userId },
        data: { version: { increment: 1 } },
      });
      const result = await record(transaction, row, month);
      await financialEvent(transaction, userId, 'investment', id, 'movement-voided', {
        entryId,
        reason,
      });
      return result;
    });
  }
  value(
    userId: string,
    id: string,
    expectedVersion: number,
    input: { asOf: string; amount: Money },
    month: string,
  ): Promise<InvestmentRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await owned(transaction, userId, id);
      if (previous.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      const row = await transaction.investment.update({
        where: { id, userId },
        data: { version: { increment: 1 } },
      });
      const value = await transaction.investmentValuation.create({
        data: {
          userId,
          investmentId: id,
          sequence: row.version,
          asOf: sqlDate(input.asOf),
          amountCents: BigInt(input.amount.minorUnits),
        },
      });
      await financialEvent(transaction, userId, 'investment', id, 'valuation-reported', {
        valuationId: value.id,
        asOf: input.asOf,
      });
      return record(transaction, row, month);
    });
  }
  async valuations(userId: string, id: string, query: ListInput) {
    await owned(this.database.client, userId, id);
    const where = { userId, investmentId: id };
    const [rows, total] = await this.database.client.$transaction([
      this.database.client.investmentValuation.findMany({
        where,
        orderBy: [{ asOf: 'desc' }, { sequence: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.investmentValuation.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        asOf: calendarDate(row.asOf),
        amount: money(row.amountCents),
      })),
      total,
    };
  }
}
