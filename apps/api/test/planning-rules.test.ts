import { describe, expect, it } from 'vitest';
import { money } from '../src/shared/domain/money.js';
import {
  assertClosable,
  calculatePlan,
  makeSnapshot,
  mergeSnapshot,
} from '../src/modules/planning/domain/plan.js';
import type { Allocation, PlanInputs, PlanSnapshot } from '../src/modules/planning/domain/plan.js';

const destination = {
  accountId: 'account',
  accountName: 'Main',
  spaceId: null,
  spaceName: null,
  institution: null,
  reference: null,
};
const source = {
  sourceId: 'source',
  sourceRevisionId: 'revision',
  sourceVersion: 1,
  name: 'Source',
  sourceInput: {},
  destination,
};
function inputs(): PlanInputs {
  return {
    fingerprint: 'a'.repeat(64),
    destinations: [destination],
    incomes: [
      {
        ...source,
        id: 'income',
        kind: 'salary',
        expectedCash: money(200000n),
        taxReserve: money(0n),
        base: money(200000n),
        vat: money(0n),
        withholding: money(0n),
        commission: money(0n),
      },
    ],
    charges: [
      {
        ...source,
        id: 'cost',
        sourceId: 'cost',
        kind: 'fixed',
        bucket: 'cost',
        amount: money(80000n),
        duePayments: [],
      },
      {
        ...source,
        id: 'provision',
        sourceId: 'provision',
        kind: 'fixed',
        bucket: 'provision',
        amount: money(10000n),
        duePayments: [{ date: '2026-10-20', amount: money(120000n) }],
      },
      {
        ...source,
        id: 'investment',
        sourceId: 'investment',
        kind: 'investment',
        bucket: 'investment',
        amount: money(20000n),
        duePayments: [],
      },
    ],
  };
}
function discretionary(
  id: string,
  purpose: 'everyday' | 'remaining',
  amount: bigint,
  remainder = false,
): Allocation {
  return { id, purpose, amount: money(amount), remainder, destination, sourceLineId: null };
}

describe('Monthly plan financial invariants', () => {
  it('keeps availability, everyday allocations, and unallocated cash distinct', () => {
    const snapshot = makeSnapshot('2026-10', inputs());
    snapshot.allocations.push(
      discretionary('daily', 'everyday', 60000n),
      discretionary('remainder', 'remaining', 0n, true),
    );
    const result = calculatePlan(snapshot);
    expect(result.summary.plannedAvailability.minorUnits).toBe('90000');
    expect(result.summary.everydayAllocation.minorUnits).toBe('60000');
    expect(result.summary.remainingAvailability.minorUnits).toBe('30000');
    expect(result.summary.unallocatedCash.minorUnits).toBe('0');
    expect(result.summary.planningCharges.minorUnits).toBe('110000');
    expect(result.allocations.find((row) => row.id === 'remainder')?.amount.minorUnits).toBe(
      '30000',
    );
    expect(() => assertClosable(snapshot, false)).not.toThrow();
  });
  it('does not double-charge due payments or account group totals', () => {
    const snapshot = makeSnapshot('2026-10', inputs());
    snapshot.allocations.push(discretionary('rest', 'remaining', 90000n));
    snapshot.allocations[0] = {
      ...snapshot.allocations[0]!,
      destination: { ...destination, spaceId: 'space', spaceName: 'Bills' },
    };
    const result = calculatePlan(snapshot);
    expect(result.groups[0]?.total.minorUnits).toBe('200000');
    expect(result.groups[0]?.directAmount.minorUnits).toBe('120000');
    expect(result.summary.plannedAvailability.minorUnits).toBe('90000');
  });
  it('reserves VAT from expected cash exactly once', () => {
    const input = inputs();
    const original = input.incomes[0];
    if (!original) throw new Error('Missing fixture');
    input.incomes = [{ ...original, expectedCash: money(96000n), taxReserve: money(21000n) }];
    input.charges = [];
    const snapshot = makeSnapshot('2026-10', input);
    snapshot.allocations.push(discretionary('rest', 'remaining', 0n, true));
    const result = calculatePlan(snapshot);
    expect(result.summary.spendableIncome.minorUnits).toBe('75000');
    expect(result.summary.plannedAvailability.minorUnits).toBe('75000');
    expect(result.summary.allocatedCash.minorUnits).toBe('96000');
  });
  it('requires reconciled cash and explicit acknowledgement of underfunding', () => {
    const input = inputs();
    const income = input.incomes[0];
    const cost = input.charges[0];
    if (!income || !cost) throw new Error('Missing fixture');
    input.incomes = [{ ...income, expectedCash: money(100000n) }];
    input.charges = [{ ...cost, amount: money(120000n) }];
    const snapshot = makeSnapshot('2026-10', input);
    expect(() => assertClosable(snapshot, true)).toThrow('ALLOCATION_MISMATCH');
    const funding = snapshot.allocations[0];
    if (!funding) throw new Error('Missing fixture');
    snapshot.allocations = [{ ...funding, amount: money(100000n) }];
    expect(calculatePlan(snapshot).summary.plannedAvailability.minorUnits).toBe('-20000');
    expect(() => assertClosable(snapshot, false)).toThrow('SHORTFALL_ACKNOWLEDGEMENT_REQUIRED');
    expect(() => assertClosable(snapshot, true)).not.toThrow();
  });
  it('preserves compatible overrides and requires explicit removal of orphaned ones', () => {
    const input = inputs();
    const snapshot = makeSnapshot('2026-10', input);
    snapshot.overrides = [
      {
        lineId: 'cost',
        sourceKind: 'charge:fixed:cost',
        amount: money(70000n),
        taxReserve: null,
        reason: 'Monthly exception',
      },
    ];
    const refreshed = mergeSnapshot(snapshot, input, [], false);
    expect(calculatePlan(refreshed).summary.monthlyCosts.minorUnits).toBe('70000');
    const removed = { ...input, charges: input.charges.filter((line) => line.id !== 'cost') };
    expect(() => mergeSnapshot(snapshot, removed, [], true)).toThrow('PLAN_REFRESH_CONFLICT');
    expect(mergeSnapshot(snapshot, removed, ['cost'], true).overrides).toHaveLength(0);
  });
  it('rejects duplicate residual destinations and invalid funding links', () => {
    const snapshot: PlanSnapshot = makeSnapshot('2026-10', inputs());
    snapshot.allocations = [
      discretionary('one', 'remaining', 0n, true),
      discretionary('two', 'remaining', 0n, true),
    ];
    expect(() => calculatePlan(snapshot)).toThrow('INVALID_PLAN_INPUT');
    snapshot.allocations = [
      { ...discretionary('bad', 'remaining', 0n), purpose: 'commitment', sourceLineId: 'missing' },
    ];
    expect(() => calculatePlan(snapshot)).toThrow('INVALID_PLAN_INPUT');
  });
});
