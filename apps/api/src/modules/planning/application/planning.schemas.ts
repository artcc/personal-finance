import { z } from 'zod';
import {
  destinationSchema,
  moneySchema,
  versionSchema,
} from '../../../shared/application/financial-input.js';
import type { PlanSnapshot, PlanSummary } from '../domain/plan.js';
import { PlanError } from '../domain/plan.js';

const outputMoney = z
  .object({ currency: z.literal('EUR'), minorUnits: z.string().regex(/^-?(0|[1-9]\d{0,14})$/) })
  .strict();
export const planDestinationSchema = destinationSchema.extend({
  accountName: z.string(),
  institution: z.string().nullable(),
  reference: z.string().nullable(),
  spaceName: z.string().nullable(),
});
const source = {
  id: z.string(),
  sourceId: z.string(),
  sourceRevisionId: z.string(),
  sourceVersion: z.number().int(),
  name: z.string(),
  sourceInput: z.record(z.string(), z.unknown()),
  destination: planDestinationSchema,
};
const income = z.object({
  ...source,
  kind: z.enum(['salary', 'professional']),
  expectedCash: moneySchema,
  taxReserve: moneySchema,
  base: moneySchema,
  vat: moneySchema,
  withholding: moneySchema,
  commission: moneySchema,
});
const charge = z.object({
  ...source,
  kind: z.string(),
  bucket: z.enum(['cost', 'provision', 'investment']),
  amount: moneySchema,
  duePayments: z.array(z.object({ date: z.string(), amount: moneySchema })),
});
export const allocationInputSchema = z
  .object({
    id: z.string().min(1).max(80),
    destination: destinationSchema,
    purpose: z.enum(['commitment', 'tax_reserve', 'everyday', 'remaining']),
    sourceLineId: z.string().min(1).max(80).nullable(),
    amount: moneySchema,
    remainder: z.boolean(),
  })
  .strict();
const allocation = allocationInputSchema.extend({ destination: planDestinationSchema });
const override = z.object({
  lineId: z.string(),
  sourceKind: z.string(),
  amount: moneySchema,
  taxReserve: moneySchema.nullable(),
  reason: z.string().min(1).max(500),
});
export const snapshotSchema: z.ZodType<PlanSnapshot> = z.object({
  policyVersion: z.literal('planning-v1'),
  month: z.string(),
  inputFingerprint: z.string(),
  incomes: z.array(income).max(500),
  charges: z.array(charge).max(500),
  allocations: z.array(allocation).max(500),
  overrides: z.array(override).max(500),
});
export const summarySchema: z.ZodType<PlanSummary> = z.object({
  expectedCash: outputMoney,
  taxReserve: outputMoney,
  spendableIncome: outputMoney,
  monthlyCosts: outputMoney,
  annualProvisions: outputMoney,
  plannedInvestment: outputMoney,
  planningCharges: outputMoney,
  plannedAvailability: outputMoney,
  allocatedCash: outputMoney,
  unallocatedCash: outputMoney,
  everydayAllocation: outputMoney,
  remainingAvailability: outputMoney,
  fundingGap: outputMoney,
});
export const versionInput = z.object({ expectedVersion: versionSchema }).strict();
export const allocationsInput = versionInput.extend({
  allocations: z.array(allocationInputSchema).max(500),
});
export const overrideInput = versionInput.extend({
  amount: moneySchema,
  taxReserve: moneySchema.nullable(),
  reason: z.string().trim().min(1).max(500),
});
export const reasonInput = versionInput.extend({ reason: z.string().trim().min(1).max(500) });
export const refreshInput = versionInput.extend({
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  discardOverrideIds: z.array(z.string().max(80)).max(500),
  resetAllocations: z.boolean(),
});
export const closeInput = versionInput.extend({ acknowledgeShortfall: z.boolean() });

export function parsePlan<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PlanError('INVALID_PLAN_INPUT');
  return parsed.data;
}
