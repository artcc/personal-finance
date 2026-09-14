import { Inject, Injectable } from '@nestjs/common';
import { validMonth } from '../../../shared/domain/calendar.js';
import type { Money } from '../../../shared/domain/money.js';
import { PLANNING_STORE } from './planning.port.js';
import type { PlanningStore, StoredPlan, PlanView, PlanningWork } from './planning.port.js';
import {
  PlanError,
  assertClosable,
  calculatePlan,
  makeSnapshot,
  mergeSnapshot,
  overrideConflicts,
  planReason,
  sourceKind,
  suggestAllocations,
} from '../domain/plan.js';
import type { AllocationInput, PlanDestination, PlanInputs, PlanSnapshot } from '../domain/plan.js';

export interface RefreshPreview {
  expectedVersion: number;
  inputFingerprint: string;
  added: string[];
  removed: string[];
  changed: string[];
  overrideConflicts: Array<{ lineId: string; name: string }>;
  allocationConflicts: string[];
}
function canonical(value: unknown): string {
  const ordered = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(ordered);
    if (item !== null && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, ordered(nested)]),
      );
    return item;
  };
  return JSON.stringify(ordered(value)) ?? '';
}
function view(plan: StoredPlan): PlanView {
  const { snapshot, summary, ...metadata } = plan;
  return { ...metadata, ...calculatePlan(snapshot), summary };
}
function expected(
  plan: StoredPlan | null,
  version: number,
  state: 'draft' | 'closed' = 'draft',
): StoredPlan {
  if (!plan) throw new PlanError('PLAN_NOT_FOUND');
  if (plan.version !== version) throw new PlanError('PLAN_VERSION_CONFLICT');
  if (plan.state !== state) throw new PlanError('PLAN_READ_ONLY');
  return plan;
}
function destinationAvailable(
  target: PlanDestination | AllocationInput['destination'],
  destinations: PlanDestination[],
): boolean {
  return destinations.some(
    (item) => item.accountId === target.accountId && item.spaceId === target.spaceId,
  );
}
function allocationConflicts(snapshot: PlanSnapshot, inputs: PlanInputs): string[] {
  return snapshot.allocations
    .filter(
      (row) =>
        !destinationAvailable(row.destination, inputs.destinations) ||
        (row.purpose === 'commitment' &&
          !inputs.charges.some((line) => line.id === row.sourceLineId)) ||
        (row.purpose === 'tax_reserve' &&
          !inputs.incomes.some((line) => line.id === row.sourceLineId)),
    )
    .map((row) => row.id);
}
async function saveDraft(
  work: PlanningWork,
  previous: StoredPlan,
  snapshot: PlanSnapshot,
  action: string,
  payload: object,
): Promise<PlanView> {
  const values = calculatePlan(snapshot);
  const saved = await work.save(previous, snapshot, values.summary, 'draft');
  await work.event(saved, action, payload);
  return view(saved);
}

@Injectable()
export class PlanningService {
  constructor(@Inject(PLANNING_STORE) private readonly store: PlanningStore) {}

  generate(userId: string, month: string): Promise<PlanView> {
    validMonth(month);
    return this.store.transaction(userId, async (work) => {
      const existing = await work.byMonth(month);
      if (existing) return view(existing);
      const snapshot = makeSnapshot(month, await work.inputs(month));
      const plan = await work.create(snapshot, calculatePlan(snapshot).summary);
      await work.event(plan, 'generated', { inputFingerprint: snapshot.inputFingerprint });
      return view(plan);
    });
  }
  get(userId: string, month: string): Promise<PlanView> {
    validMonth(month);
    return this.store.transaction(userId, async (work) => {
      const plan = await work.byMonth(month);
      if (!plan) throw new PlanError('PLAN_NOT_FOUND');
      return view(plan);
    });
  }
  revision(userId: string, id: string, revision: number): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = await work.byId(id, revision);
      if (!plan) throw new PlanError('PLAN_NOT_FOUND');
      return view(plan);
    });
  }
  history(userId: string, id: string, page: number) {
    return this.store.history(userId, id, page);
  }
  trend(userId: string, month: string) {
    validMonth(month);
    const ordinal = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
    const start = Math.max(1900 * 12, ordinal - 5);
    const from = `${Math.floor(start / 12)}-${String((start % 12) + 1).padStart(2, '0')}`;
    return this.store.trend(userId, from, month);
  }

  override(
    userId: string,
    id: string,
    lineId: string,
    input: { expectedVersion: number; amount: Money; taxReserve: Money | null; reason: string },
  ): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), input.expectedVersion);
      const line = [...plan.snapshot.incomes, ...plan.snapshot.charges].find(
        (item) => item.id === lineId,
      );
      if (!line) throw new PlanError('PLAN_LINE_NOT_FOUND');
      const override = {
        lineId,
        sourceKind: sourceKind(line),
        amount: input.amount,
        taxReserve: input.taxReserve,
        reason: planReason(input.reason),
      };
      const snapshot = {
        ...plan.snapshot,
        overrides: [...plan.snapshot.overrides.filter((item) => item.lineId !== lineId), override],
      };
      return saveDraft(work, plan, snapshot, 'line-overridden', {
        lineId,
        reason: override.reason,
      });
    });
  }
  restore(
    userId: string,
    id: string,
    lineId: string,
    input: { expectedVersion: number; reason: string },
  ): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), input.expectedVersion);
      if (![...plan.snapshot.incomes, ...plan.snapshot.charges].some((line) => line.id === lineId))
        throw new PlanError('PLAN_LINE_NOT_FOUND');
      const reason = planReason(input.reason);
      return saveDraft(
        work,
        plan,
        {
          ...plan.snapshot,
          overrides: plan.snapshot.overrides.filter((item) => item.lineId !== lineId),
        },
        'line-restored',
        { lineId, reason },
      );
    });
  }
  allocations(
    userId: string,
    id: string,
    input: { expectedVersion: number; allocations: AllocationInput[] },
  ): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), input.expectedVersion);
      const destinations = await work.destinations(plan.month);
      const allocations = input.allocations.map((row) => {
        const destination = destinations.find(
          (item) =>
            item.accountId === row.destination.accountId &&
            item.spaceId === row.destination.spaceId,
        );
        if (!destination) throw new PlanError('INVALID_ALLOCATION_DESTINATION');
        return { ...row, destination };
      });
      return saveDraft(work, plan, { ...plan.snapshot, allocations }, 'allocations-updated', {
        allocationCount: allocations.length,
      });
    });
  }
  suggest(userId: string, id: string, version: number): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), version);
      const destinations = await work.destinations(plan.month);
      const allocations = suggestAllocations(plan.snapshot);
      if (allocations.some((row) => !destinationAvailable(row.destination, destinations)))
        throw new PlanError('INVALID_ALLOCATION_DESTINATION');
      return saveDraft(work, plan, { ...plan.snapshot, allocations }, 'allocations-reset', {});
    });
  }
  refreshPreview(userId: string, id: string, version: number): Promise<RefreshPreview> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), version);
      const inputs = await work.inputs(plan.month);
      const previous = [...plan.snapshot.incomes, ...plan.snapshot.charges];
      const next = [...inputs.incomes, ...inputs.charges];
      return {
        expectedVersion: version,
        inputFingerprint: inputs.fingerprint,
        added: next
          .filter((line) => !previous.some((old) => old.id === line.id))
          .map((line) => line.name),
        removed: previous
          .filter((line) => !next.some((fresh) => fresh.id === line.id))
          .map((line) => line.name),
        changed: next
          .filter((line) => {
            const old = previous.find((item) => item.id === line.id);
            return old && canonical(old) !== canonical(line);
          })
          .map((line) => line.name),
        overrideConflicts: overrideConflicts(plan.snapshot, inputs).map((lineId) => ({
          lineId,
          name: previous.find((line) => line.id === lineId)?.name ?? lineId,
        })),
        allocationConflicts: allocationConflicts(plan.snapshot, inputs),
      };
    });
  }
  refresh(
    userId: string,
    id: string,
    input: {
      expectedVersion: number;
      inputFingerprint: string;
      discardOverrideIds: string[];
      resetAllocations: boolean;
    },
  ): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), input.expectedVersion);
      const inputs = await work.inputs(plan.month);
      if (
        inputs.fingerprint !== input.inputFingerprint ||
        (!input.resetAllocations && allocationConflicts(plan.snapshot, inputs).length > 0)
      )
        throw new PlanError('PLAN_REFRESH_CONFLICT');
      const snapshot = mergeSnapshot(
        plan.snapshot,
        inputs,
        input.discardOverrideIds,
        input.resetAllocations,
      );
      return saveDraft(work, plan, snapshot, 'sources-refreshed', {
        discardedOverrides: input.discardOverrideIds,
        resetAllocations: input.resetAllocations,
        inputFingerprint: inputs.fingerprint,
      });
    });
  }
  close(
    userId: string,
    id: string,
    version: number,
    acknowledgeShortfall: boolean,
  ): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), version);
      const destinations = await work.destinations(plan.month);
      if (
        [...plan.snapshot.incomes, ...plan.snapshot.charges, ...plan.snapshot.allocations].some(
          (line) => !destinationAvailable(line.destination, destinations),
        )
      )
        throw new PlanError('INVALID_ALLOCATION_DESTINATION');
      assertClosable(plan.snapshot, acknowledgeShortfall);
      const closed = await work.save(
        plan,
        plan.snapshot,
        calculatePlan(plan.snapshot).summary,
        'closed',
      );
      await work.event(closed, 'closed', { acknowledgeShortfall });
      return view(closed);
    });
  }
  reopen(userId: string, id: string, version: number, reason: string): Promise<PlanView> {
    return this.store.transaction(userId, async (work) => {
      const plan = expected(await work.byId(id), version, 'closed');
      const reopened = await work.save(
        plan,
        plan.snapshot,
        plan.summary,
        'draft',
        planReason(reason),
      );
      await work.event(reopened, 'reopened', {
        previousRevision: plan.revision,
        reason: reopened.reopenReason,
      });
      return view(reopened);
    });
  }
}
