import { cents, money } from '../../../shared/domain/money.js';
import type { Money } from '../../../shared/domain/money.js';
import type { Destination } from '../../../shared/domain/calendar.js';
import { validMonth } from '../../../shared/domain/calendar.js';

export type PlanErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_LINE_NOT_FOUND'
  | 'PLAN_READ_ONLY'
  | 'PLAN_VERSION_CONFLICT'
  | 'PLAN_REFRESH_CONFLICT'
  | 'INVALID_PLANNING_SOURCE'
  | 'INVALID_ALLOCATION_DESTINATION'
  | 'INVALID_PLAN_INPUT'
  | 'ALLOCATION_MISMATCH'
  | 'SHORTFALL_ACKNOWLEDGEMENT_REQUIRED';
export class PlanError extends Error {
  constructor(readonly code: PlanErrorCode) {
    super(code);
    this.name = 'PlanError';
  }
}
export interface PlanDestination extends Destination {
  accountName: string;
  institution: string | null;
  reference: string | null;
  spaceName: string | null;
}
export interface SourceLine {
  id: string;
  sourceId: string;
  sourceRevisionId: string;
  sourceVersion: number;
  name: string;
  sourceInput: Record<string, unknown>;
  destination: PlanDestination;
}
export interface IncomeLine extends SourceLine {
  kind: 'salary' | 'professional';
  expectedCash: Money;
  taxReserve: Money;
  base: Money;
  vat: Money;
  withholding: Money;
  commission: Money;
}
export interface ChargeLine extends SourceLine {
  kind: string;
  bucket: 'cost' | 'provision' | 'investment';
  amount: Money;
  duePayments: Array<{ date: string; amount: Money }>;
}
export interface PlanOverride {
  lineId: string;
  sourceKind: string;
  amount: Money;
  taxReserve: Money | null;
  reason: string;
}
export type AllocationPurpose = 'commitment' | 'tax_reserve' | 'everyday' | 'remaining';
export interface AllocationInput {
  id: string;
  destination: Destination;
  purpose: AllocationPurpose;
  sourceLineId: string | null;
  amount: Money;
  remainder: boolean;
}
export interface Allocation extends AllocationInput {
  destination: PlanDestination;
}
export interface PlanInputs {
  incomes: IncomeLine[];
  charges: ChargeLine[];
  destinations: PlanDestination[];
  fingerprint: string;
}
export interface PlanSnapshot {
  policyVersion: 'planning-v1';
  month: string;
  inputFingerprint: string;
  incomes: IncomeLine[];
  charges: ChargeLine[];
  overrides: PlanOverride[];
  allocations: Allocation[];
}
export interface PlanSummary {
  expectedCash: Money;
  taxReserve: Money;
  spendableIncome: Money;
  monthlyCosts: Money;
  annualProvisions: Money;
  plannedInvestment: Money;
  planningCharges: Money;
  plannedAvailability: Money;
  allocatedCash: Money;
  unallocatedCash: Money;
  everydayAllocation: Money;
  remainingAvailability: Money;
  fundingGap: Money;
}
export interface IncomeView extends IncomeLine {
  originalExpectedCash: Money;
  originalTaxReserve: Money;
  spendableIncome: Money;
  overrideReason: string | null;
}
export interface ChargeView extends ChargeLine {
  originalAmount: Money;
  overrideReason: string | null;
}
export interface AllocationView extends Allocation {
  label: string;
}
export interface AllocationGroup {
  accountId: string;
  accountName: string;
  directAmount: Money;
  total: Money;
  allocations: AllocationView[];
}
export interface PlanValues {
  summary: PlanSummary;
  incomes: IncomeView[];
  charges: ChargeView[];
  allocations: AllocationView[];
  groups: AllocationGroup[];
}

export function sourceKind(line: IncomeLine | ChargeLine): string {
  const frequency = line.sourceInput.frequency;
  return 'bucket' in line
    ? `charge:${line.kind}:${line.bucket}${frequency === 'annual' || frequency === 'monthly' ? `:${frequency}` : ''}`
    : `income:${line.kind}`;
}
export function planReason(value: string): string {
  const reason = value.trim();
  if (!reason || reason.length > 500) throw new PlanError('INVALID_PLAN_INPUT');
  return reason;
}

export function calculatePlan(snapshot: PlanSnapshot): PlanValues {
  validMonth(snapshot.month);
  if (
    snapshot.policyVersion !== 'planning-v1' ||
    snapshot.incomes.length + snapshot.charges.length > 500 ||
    snapshot.allocations.length > 500
  )
    throw new PlanError('INVALID_PLAN_INPUT');
  const sources = [...snapshot.incomes, ...snapshot.charges];
  if (
    new Set(sources.map((line) => line.id)).size !== sources.length ||
    new Set(snapshot.overrides.map((item) => item.lineId)).size !== snapshot.overrides.length
  )
    throw new PlanError('INVALID_PLAN_INPUT');
  for (const override of snapshot.overrides) {
    const line = sources.find((source) => source.id === override.lineId);
    if (!line || sourceKind(line) !== override.sourceKind)
      throw new PlanError('PLAN_REFRESH_CONFLICT');
    cents(override.amount);
    planReason(override.reason);
    if ('bucket' in line ? override.taxReserve !== null : override.taxReserve === null)
      throw new PlanError('INVALID_PLAN_INPUT');
    if (override.taxReserve) cents(override.taxReserve);
  }
  const incomes: IncomeView[] = snapshot.incomes.map((line) => {
    const override = snapshot.overrides.find((item) => item.lineId === line.id);
    const cash = override?.amount ?? line.expectedCash;
    const reserve = override?.taxReserve ?? line.taxReserve;
    return {
      ...line,
      originalExpectedCash: line.expectedCash,
      originalTaxReserve: line.taxReserve,
      expectedCash: cash,
      taxReserve: reserve,
      spendableIncome: money(cents(cash) - cents(reserve)),
      overrideReason: override?.reason ?? null,
    };
  });
  const charges: ChargeView[] = snapshot.charges.map((line) => {
    const override = snapshot.overrides.find((item) => item.lineId === line.id);
    return {
      ...line,
      originalAmount: line.amount,
      amount: override?.amount ?? line.amount,
      overrideReason: override?.reason ?? null,
    };
  });
  const expectedCash = incomes.reduce((sum, line) => sum + cents(line.expectedCash), 0n);
  const taxReserve = incomes.reduce((sum, line) => sum + cents(line.taxReserve), 0n);
  const sumBucket = (bucket: ChargeLine['bucket']) =>
    charges
      .filter((line) => line.bucket === bucket)
      .reduce((sum, line) => sum + cents(line.amount), 0n);
  const monthlyCosts = sumBucket('cost');
  const annualProvisions = sumBucket('provision');
  const plannedInvestment = sumBucket('investment');
  const planningCharges = monthlyCosts + annualProvisions + plannedInvestment;
  const availability = expectedCash - taxReserve - planningCharges;
  if (
    new Set(snapshot.allocations.map((row) => row.id)).size !== snapshot.allocations.length ||
    snapshot.allocations.filter((row) => row.remainder).length > 1
  )
    throw new PlanError('INVALID_PLAN_INPUT');
  const fixed = snapshot.allocations
    .filter((row) => !row.remainder)
    .reduce((sum, row) => sum + cents(row.amount), 0n);
  const remainder = expectedCash > fixed ? expectedCash - fixed : 0n;
  const allocations: AllocationView[] = snapshot.allocations.map((row) => {
    cents(row.amount);
    if (
      !row.id ||
      row.id.length > 80 ||
      !['commitment', 'tax_reserve', 'everyday', 'remaining'].includes(row.purpose)
    )
      throw new PlanError('INVALID_PLAN_INPUT');
    if (row.remainder && (row.purpose !== 'remaining' || row.sourceLineId !== null))
      throw new PlanError('INVALID_PLAN_INPUT');
    const linked =
      row.purpose === 'commitment'
        ? charges.find((line) => line.id === row.sourceLineId)
        : row.purpose === 'tax_reserve'
          ? incomes.find((line) => line.id === row.sourceLineId)
          : null;
    if (['commitment', 'tax_reserve'].includes(row.purpose) ? !linked : row.sourceLineId !== null)
      throw new PlanError('INVALID_PLAN_INPUT');
    return {
      ...row,
      amount: row.remainder ? money(remainder) : row.amount,
      label: linked?.name ?? '',
    };
  });
  const allocated = allocations.reduce((sum, row) => sum + cents(row.amount), 0n);
  const everyday = allocations
    .filter((row) => row.purpose === 'everyday')
    .reduce((sum, row) => sum + cents(row.amount), 0n);
  let fundingGap = 0n;
  for (const line of [...charges, ...incomes]) {
    const purpose = 'bucket' in line ? 'commitment' : 'tax_reserve';
    const needed = cents('bucket' in line ? line.amount : line.taxReserve);
    const assigned = allocations
      .filter((row) => row.purpose === purpose && row.sourceLineId === line.id)
      .reduce((sum, row) => sum + cents(row.amount), 0n);
    if (needed > assigned) fundingGap += needed - assigned;
  }
  const groups = new Map<string, AllocationGroup>();
  for (const allocation of allocations) {
    const destination = allocation.destination;
    let group = groups.get(destination.accountId);
    if (!group) {
      group = {
        accountId: destination.accountId,
        accountName: destination.accountName,
        directAmount: money(0n),
        total: money(0n),
        allocations: [],
      };
      groups.set(destination.accountId, group);
    }
    group.allocations.push(allocation);
    group.total = money(cents(group.total) + cents(allocation.amount));
    if (destination.spaceId === null)
      group.directAmount = money(cents(group.directAmount) + cents(allocation.amount));
  }
  return {
    incomes,
    charges,
    allocations,
    groups: [...groups.values()],
    summary: {
      expectedCash: money(expectedCash),
      taxReserve: money(taxReserve),
      spendableIncome: money(expectedCash - taxReserve),
      monthlyCosts: money(monthlyCosts),
      annualProvisions: money(annualProvisions),
      plannedInvestment: money(plannedInvestment),
      planningCharges: money(planningCharges),
      plannedAvailability: money(availability),
      allocatedCash: money(allocated),
      unallocatedCash: money(expectedCash - allocated),
      everydayAllocation: money(everyday),
      remainingAvailability: money(availability - everyday),
      fundingGap: money(fundingGap),
    },
  };
}

export function suggestAllocations(snapshot: PlanSnapshot): Allocation[] {
  const values = calculatePlan({ ...snapshot, allocations: [] });
  return [
    ...values.charges.map((line): Allocation => ({
      id: line.id,
      destination: line.destination,
      purpose: 'commitment',
      sourceLineId: line.id,
      amount: line.amount,
      remainder: false,
    })),
    ...values.incomes
      .filter((line) => cents(line.taxReserve) > 0n)
      .map((line): Allocation => ({
        id: `tax:${line.sourceId}`,
        destination: line.destination,
        purpose: 'tax_reserve',
        sourceLineId: line.id,
        amount: line.taxReserve,
        remainder: false,
      })),
  ];
}

export function makeSnapshot(month: string, inputs: PlanInputs): PlanSnapshot {
  const snapshot: PlanSnapshot = {
    policyVersion: 'planning-v1',
    month: validMonth(month),
    inputFingerprint: inputs.fingerprint,
    incomes: inputs.incomes,
    charges: inputs.charges,
    overrides: [],
    allocations: [],
  };
  snapshot.allocations = suggestAllocations(snapshot);
  calculatePlan(snapshot);
  return snapshot;
}

export function assertClosable(snapshot: PlanSnapshot, acknowledgeShortfall: boolean): void {
  const { summary } = calculatePlan(snapshot);
  if (cents(summary.unallocatedCash, false) !== 0n) throw new PlanError('ALLOCATION_MISMATCH');
  if (
    (cents(summary.plannedAvailability, false) < 0n || cents(summary.fundingGap) > 0n) &&
    !acknowledgeShortfall
  )
    throw new PlanError('SHORTFALL_ACKNOWLEDGEMENT_REQUIRED');
}

export function overrideConflicts(snapshot: PlanSnapshot, inputs: PlanInputs): string[] {
  const lines = [...inputs.incomes, ...inputs.charges];
  return snapshot.overrides
    .filter(
      (item) =>
        !lines.some((line) => line.id === item.lineId && sourceKind(line) === item.sourceKind),
    )
    .map((item) => item.lineId);
}

export function mergeSnapshot(
  snapshot: PlanSnapshot,
  inputs: PlanInputs,
  discardOverrideIds: string[],
  resetAllocations: boolean,
): PlanSnapshot {
  if (
    discardOverrideIds.some((id) => !snapshot.overrides.some((item) => item.lineId === id)) ||
    overrideConflicts(snapshot, inputs).some((id) => !discardOverrideIds.includes(id))
  )
    throw new PlanError('PLAN_REFRESH_CONFLICT');
  const merged: PlanSnapshot = {
    ...snapshot,
    incomes: inputs.incomes,
    charges: inputs.charges,
    inputFingerprint: inputs.fingerprint,
    overrides: snapshot.overrides.filter((item) => !discardOverrideIds.includes(item.lineId)),
    allocations: resetAllocations ? [] : snapshot.allocations,
  };
  if (resetAllocations) merged.allocations = suggestAllocations(merged);
  calculatePlan(merged);
  return merged;
}
