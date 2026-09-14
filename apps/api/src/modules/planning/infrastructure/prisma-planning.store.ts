import { Inject, Injectable } from '@nestjs/common';
import type { MonthlyPlan, MonthlyPlanRevision } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../shared/database.service.js';
import {
  financialEvent,
  financialWrite,
  jsonInput,
} from '../../../shared/infrastructure/financial-write.js';
import { money } from '../../../shared/domain/money.js';
import { PlanError } from '../domain/plan.js';
import type { PlanSnapshot, PlanSummary } from '../domain/plan.js';
import type {
  PlanningStore,
  PlanningWork,
  StoredPlan,
  PlanHistoryItem,
  PlanTrendItem,
} from '../application/planning.port.js';
import { snapshotSchema, summarySchema } from '../application/planning.schemas.js';
import { readPlanningInputs, readPlanDestinations } from './planning-inputs.js';

function stored(plan: MonthlyPlan, revision: MonthlyPlanRevision): StoredPlan {
  if (revision.state !== 'draft' && revision.state !== 'closed')
    throw new Error('Invalid plan revision state');
  return {
    id: plan.id,
    month: plan.month,
    revision: revision.number,
    currentRevision: plan.currentRevision,
    version: revision.version,
    state: revision.state,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    closedAt: revision.closedAt?.toISOString() ?? null,
    reopenReason: revision.reopenReason,
    snapshot: snapshotSchema.parse(revision.snapshot),
    summary: summarySchema.parse(revision.summary),
  };
}
function amounts(snapshot: PlanSnapshot, summary: PlanSummary) {
  return {
    snapshot: jsonInput(snapshot),
    summary: jsonInput(summary),
    expectedCashCents: BigInt(summary.expectedCash.minorUnits),
    taxReserveCents: BigInt(summary.taxReserve.minorUnits),
    chargesCents: BigInt(summary.planningCharges.minorUnits),
    availabilityCents: BigInt(summary.plannedAvailability.minorUnits),
    allocatedCashCents: BigInt(summary.allocatedCash.minorUnits),
    fundingGapCents: BigInt(summary.fundingGap.minorUnits),
  };
}

@Injectable()
export class PrismaPlanningStore implements PlanningStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  transaction<T>(userId: string, operation: (work: PlanningWork) => Promise<T>): Promise<T> {
    return financialWrite(this.database, userId, async (transaction) => {
      const byId = async (id: string, number?: number): Promise<StoredPlan | null> => {
        const plan = await transaction.monthlyPlan.findFirst({ where: { id, userId } });
        if (!plan) return null;
        const revision = await transaction.monthlyPlanRevision.findFirst({
          where: { planId: id, userId, number: number ?? plan.currentRevision },
        });
        return revision ? stored(plan, revision) : null;
      };
      return operation({
        byId,
        byMonth: async (month) => {
          const plan = await transaction.monthlyPlan.findUnique({
            where: { userId_month: { userId, month } },
          });
          return plan ? byId(plan.id) : null;
        },
        inputs: (month) => readPlanningInputs(transaction, userId, month),
        destinations: (month) => readPlanDestinations(transaction, userId, month),
        create: async (snapshot, summary) => {
          const plan = await transaction.monthlyPlan.create({
            data: { userId, month: snapshot.month },
          });
          const revision = await transaction.monthlyPlanRevision.create({
            data: {
              planId: plan.id,
              userId,
              number: 1,
              version: 1,
              state: 'draft',
              ...amounts(snapshot, summary),
            },
          });
          return stored(plan, revision);
        },
        save: async (previous, snapshot, summary, state, reopenReason) => {
          const plan = await transaction.monthlyPlan.update({
            where: { id: previous.id, userId, version: previous.version },
            data: {
              version: { increment: 1 },
              ...(reopenReason !== undefined ? { currentRevision: { increment: 1 } } : {}),
            },
          });
          const revision =
            reopenReason !== undefined
              ? await transaction.monthlyPlanRevision.create({
                  data: {
                    planId: plan.id,
                    userId,
                    number: plan.currentRevision,
                    version: plan.version,
                    state: 'draft',
                    reopenReason,
                    ...amounts(snapshot, summary),
                  },
                })
              : await transaction.monthlyPlanRevision.update({
                  where: {
                    planId_number: { planId: plan.id, number: plan.currentRevision },
                    userId,
                  },
                  data: {
                    ...amounts(snapshot, summary),
                    version: plan.version,
                    state,
                    closedAt: state === 'closed' ? new Date() : null,
                  },
                });
          return stored(plan, revision);
        },
        event: (plan, action, payload) =>
          financialEvent(transaction, userId, 'monthly-plan', plan.id, action, {
            revision: plan.revision,
            version: plan.version,
            ...payload,
          }),
      });
    });
  }
  async history(
    userId: string,
    planId: string,
    page: number,
  ): Promise<{ items: PlanHistoryItem[]; total: number }> {
    if (
      !(await this.database.client.monthlyPlan.findFirst({
        where: { id: planId, userId },
        select: { id: true },
      }))
    )
      throw new PlanError('PLAN_NOT_FOUND');
    const [rows, total] = await this.database.client.$transaction([
      this.database.client.monthlyPlanRevision.findMany({
        where: { planId, userId },
        orderBy: { number: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
      }),
      this.database.client.monthlyPlanRevision.count({ where: { planId, userId } }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        revision: row.number,
        version: row.version,
        state: row.state === 'closed' ? 'closed' : 'draft',
        createdAt: row.createdAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
        reopenReason: row.reopenReason,
        availability: money(row.availabilityCents),
      })),
    };
  }
  async trend(userId: string, fromMonth: string, throughMonth: string): Promise<PlanTrendItem[]> {
    const plans = await this.database.client.monthlyPlan.findMany({
      where: { userId, month: { gte: fromMonth, lte: throughMonth } },
      orderBy: { month: 'asc' },
      take: 6,
      include: { revisions: { orderBy: { number: 'desc' }, take: 1 } },
    });
    return plans.flatMap((plan): PlanTrendItem[] => {
      const revision = plan.revisions[0];
      return revision
        ? [
            {
              month: plan.month,
              state: revision.state === 'closed' ? 'closed' : 'draft',
              availability: money(revision.availabilityCents),
            },
          ]
        : [];
    });
  }
}
