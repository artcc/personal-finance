import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database.service.js';
import {
  financialWrite,
  financialEvent,
  jsonInput,
  sqlDate,
} from '../../../shared/infrastructure/financial-write.js';
import type { FinancialTransaction } from '../../../shared/infrastructure/financial-write.js';
import type { DataStore } from '../application/data.port.js';
import { DataFileError, documentCounts } from '../application/document.js';
import type { FinancialDocument } from '../application/document.js';
import { remapData } from '../application/remap-document.js';
import { readExport } from './export-data.js';

async function empty(transaction: FinancialTransaction, userId: string): Promise<boolean> {
  const counts = await Promise.all([
    transaction.account.count({ where: { userId } }),
    transaction.incomeSource.count({ where: { userId } }),
    transaction.commitmentSource.count({ where: { userId } }),
    transaction.monthlyPlan.count({ where: { userId } }),
    transaction.financing.count({ where: { userId } }),
    transaction.investment.count({ where: { userId } }),
    transaction.financialEvent.count({ where: { userId } }),
  ]);
  return counts.every((count) => count === 0);
}

@Injectable()
export class PrismaDataStore implements DataStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  export(userId: string): Promise<FinancialDocument> {
    return this.database.client.$transaction((transaction) => readExport(transaction, userId), {
      isolationLevel: 'RepeatableRead',
      timeout: 60000,
    });
  }
  isEmpty(userId: string): Promise<boolean> {
    return this.database.client.$transaction((transaction) => empty(transaction, userId), {
      isolationLevel: 'RepeatableRead',
    });
  }
  import(userId: string, document: FinancialDocument, fingerprint: string): Promise<void> {
    return financialWrite(
      this.database,
      userId,
      async (transaction) => {
        if (!(await empty(transaction, userId)))
          throw new DataFileError('IMPORT_REQUIRES_EMPTY_WORKSPACE');
        const data = remapData(document.data);
        await transaction.account.createMany({
          data: data.accounts.map((row) => ({ ...row, userId })),
        });
        await transaction.space.createMany({
          data: data.spaces.map((row) => ({ ...row, userId })),
        });
        await transaction.incomeSource.createMany({
          data: data.incomeSources.map((row) => ({ ...row, userId })),
        });
        await transaction.incomeRevision.createMany({
          data: data.incomeRevisions.map((row) => ({
            ...row,
            userId,
            input: jsonInput(row.input),
            startsOn: sqlDate(row.startsOn),
            endsOn: row.endsOn === null ? null : sqlDate(row.endsOn),
            baseCents: BigInt(row.baseCents),
            vatCents: BigInt(row.vatCents),
            withholdingCents: BigInt(row.withholdingCents),
            commissionCents: BigInt(row.commissionCents),
            cashCents: BigInt(row.cashCents),
            reserveCents: BigInt(row.reserveCents),
            spendableCents: BigInt(row.spendableCents),
          })),
        });
        await transaction.commitmentSource.createMany({
          data: data.commitmentSources.map((row) => ({ ...row, userId })),
        });
        await transaction.commitmentRevision.createMany({
          data: data.commitmentRevisions.map((row) => ({
            ...row,
            userId,
            input: jsonInput(row.input),
            startsOn: sqlDate(row.startsOn),
            endsOn: row.endsOn === null ? null : sqlDate(row.endsOn),
            amountCents: BigInt(row.amountCents),
          })),
        });
        await transaction.commitmentInstallment.createMany({
          data: data.commitmentInstallments.map((row) => ({
            ...row,
            amountCents: BigInt(row.amountCents),
          })),
        });
        await transaction.financing.createMany({
          data: data.financings.map((row) => ({
            ...row,
            userId,
            originalPrincipalCents:
              row.originalPrincipalCents === null ? null : BigInt(row.originalPrincipalCents),
          })),
        });
        await transaction.financingBalance.createMany({
          data: data.financingBalances.map((row) => ({
            ...row,
            userId,
            asOf: sqlDate(row.asOf),
            amountCents: BigInt(row.amountCents),
          })),
        });
        await transaction.investment.createMany({
          data: data.investments.map((row) => ({ ...row, userId })),
        });
        await transaction.investmentEntry.createMany({
          data: data.investmentEntries.map((row) => ({
            ...row,
            userId,
            date: sqlDate(row.date),
            amountCents: row.amountCents === null ? null : BigInt(row.amountCents),
          })),
        });
        await transaction.investmentValuation.createMany({
          data: data.investmentValuations.map((row) => ({
            ...row,
            userId,
            asOf: sqlDate(row.asOf),
            amountCents: BigInt(row.amountCents),
          })),
        });
        await transaction.monthlyPlan.createMany({
          data: data.monthlyPlans.map((row) => ({ ...row, userId })),
        });
        await transaction.monthlyPlanRevision.createMany({
          data: data.monthlyPlanRevisions.map((row) => ({
            ...row,
            userId,
            snapshot: jsonInput(row.snapshot),
            summary: jsonInput(row.summary),
            expectedCashCents: BigInt(row.expectedCashCents),
            taxReserveCents: BigInt(row.taxReserveCents),
            chargesCents: BigInt(row.chargesCents),
            availabilityCents: BigInt(row.availabilityCents),
            allocatedCashCents: BigInt(row.allocatedCashCents),
            fundingGapCents: BigInt(row.fundingGapCents),
          })),
        });
        await transaction.financialEvent.createMany({
          data: data.financialEvents.map((row) => ({
            ...row,
            userId,
            payload: jsonInput(row.payload),
          })),
        });
        const total = Object.values(documentCounts(document)).reduce(
          (sum, count) => sum + count,
          0,
        );
        if (total > 0)
          await financialEvent(transaction, userId, 'data-portability', userId, 'json-imported', {
            formatVersion: document.formatVersion,
            exportedAt: document.exportedAt,
            fingerprint,
            counts: documentCounts(document),
          });
      },
      60000,
    );
  }
}
