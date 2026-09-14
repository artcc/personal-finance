import { Inject, Injectable } from '@nestjs/common';
import type { Financing } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../shared/database.service.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';
import { money } from '../../../shared/domain/money.js';
import {
  financialWrite,
  financialEvent,
  calendarDate,
  sqlDate,
} from '../../../shared/infrastructure/financial-write.js';
import type { FinancialTransaction } from '../../../shared/infrastructure/financial-write.js';
import { createPlanningLink, linkedPlan } from '../../../shared/infrastructure/planning-link.js';
import type {
  FinancingStore,
  FinancingRecord,
  FinancingMetadata,
} from '../application/financing.port.js';
import type { PlanningLinkInput } from '../../../shared/application/planning-link.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import type { Money } from '../../../shared/domain/money.js';

async function record(
  transaction: FinancialTransaction,
  row: Financing,
  month: string,
): Promise<FinancingRecord> {
  const debt = await transaction.financingBalance.findFirst({
    where: { financingId: row.id, userId: row.userId },
    orderBy: [{ asOf: 'desc' }, { sequence: 'desc' }],
  });
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    lender: row.lender,
    originalPrincipal:
      row.originalPrincipalCents === null ? null : money(row.originalPrincipalCents),
    planning: await linkedPlan(transaction, row.userId, row.planningSourceId, month),
    latestDebt: debt
      ? { id: debt.id, asOf: calendarDate(debt.asOf), amount: money(debt.amountCents) }
      : null,
  };
}
@Injectable()
export class PrismaFinancingStore implements FinancingStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  detail(userId: string, id: string, month: string): Promise<FinancingRecord> {
    return this.database.client.$transaction(
      async (transaction) => {
        const row = await transaction.financing.findFirst({ where: { id, userId } });
        if (!row) throw new FinancialError('FINANCING_NOT_FOUND');
        return record(transaction, row, month);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async list(userId: string, query: ListInput, month: string) {
    const where = {
      userId,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { lender: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return this.database.client.$transaction(
      async (transaction) => {
        const rows = await transaction.financing.findMany({
          where,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          items: await Promise.all(rows.map((row) => record(transaction, row, month))),
          total: await transaction.financing.count({ where }),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  create(
    userId: string,
    input: FinancingMetadata & { planning: PlanningLinkInput },
    month: string,
  ): Promise<FinancingRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const source = await createPlanningLink(
        transaction,
        userId,
        'financing',
        input.planning,
        month,
      );
      const row = await transaction.financing.create({
        data: {
          userId,
          planningSourceId: source.id,
          name: input.name,
          lender: input.lender,
          originalPrincipalCents: input.originalPrincipal
            ? BigInt(input.originalPrincipal.minorUnits)
            : null,
        },
      });
      await financialEvent(transaction, userId, 'financing', row.id, 'created', {
        planningSourceId: source.id,
      });
      return record(transaction, row, month);
    });
  }
  update(
    userId: string,
    id: string,
    input: FinancingMetadata,
    expectedVersion: number,
    month: string,
  ): Promise<FinancingRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await transaction.financing.findFirst({ where: { id, userId } });
      if (!previous) throw new FinancialError('FINANCING_NOT_FOUND');
      if (previous.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      const row = await transaction.financing.update({
        where: { id, userId },
        data: {
          name: input.name,
          lender: input.lender,
          originalPrincipalCents: input.originalPrincipal
            ? BigInt(input.originalPrincipal.minorUnits)
            : null,
          version: { increment: 1 },
        },
      });
      await financialEvent(transaction, userId, 'financing', id, 'updated', {
        before: {
          name: previous.name,
          lender: previous.lender,
          originalPrincipal: previous.originalPrincipalCents?.toString() ?? null,
        },
        after: input,
        expectedVersion,
      });
      return record(transaction, row, month);
    });
  }
  report(
    userId: string,
    id: string,
    input: { asOf: string; amount: Money; expectedVersion: number },
    month: string,
  ): Promise<FinancingRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await transaction.financing.findFirst({ where: { id, userId } });
      if (!previous) throw new FinancialError('FINANCING_NOT_FOUND');
      if (previous.version !== input.expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      const row = await transaction.financing.update({
        where: { id, userId },
        data: { version: { increment: 1 } },
      });
      const debt = await transaction.financingBalance.create({
        data: {
          userId,
          financingId: id,
          sequence: row.version,
          asOf: sqlDate(input.asOf),
          amountCents: BigInt(input.amount.minorUnits),
        },
      });
      await financialEvent(transaction, userId, 'financing', id, 'debt-reported', {
        reportId: debt.id,
        asOf: input.asOf,
        amount: input.amount,
      });
      return record(transaction, row, month);
    });
  }
  async reports(userId: string, id: string, query: ListInput) {
    if (
      !(await this.database.client.financing.findFirst({
        where: { id, userId },
        select: { id: true },
      }))
    )
      throw new FinancialError('FINANCING_NOT_FOUND');
    const where = { userId, financingId: id };
    const [rows, total] = await this.database.client.$transaction([
      this.database.client.financingBalance.findMany({
        where,
        orderBy: [{ asOf: 'desc' }, { sequence: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.financingBalance.count({ where }),
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
