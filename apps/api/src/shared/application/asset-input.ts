import { z } from 'zod';
import { commitmentDefinitionSchema, moneySchema, versionSchema } from './financial-input.js';

export const planningLinkSchema = z
  .object({
    sourceId: z.uuid().nullable(),
    expectedVersion: versionSchema.nullable(),
    definition: commitmentDefinitionSchema.nullable(),
  })
  .strict();
export const financingMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    lender: z.string().trim().max(120).nullable(),
    originalPrincipal: moneySchema.nullable(),
  })
  .strict();
export const financingCreateSchema = financingMetadataSchema.extend({
  planning: planningLinkSchema,
});
export const reportSchema = z
  .object({ expectedVersion: versionSchema, asOf: z.iso.date(), amount: moneySchema })
  .strict();
export const investmentMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    platform: z.string().trim().max(120).nullable(),
    ticker: z.string().trim().max(30).nullable(),
    kind: z.enum(['fund', 'pension', 'crypto', 'other']),
  })
  .strict();
export const investmentCreateSchema = investmentMetadataSchema.extend({
  mode: z.enum(['contributions', 'units']),
  planning: planningLinkSchema.nullable(),
});
export const movementSchema = z
  .object({
    date: z.iso.date(),
    kind: z.enum(['opening', 'contribution', 'withdrawal', 'buy', 'sell']),
    quantity: z
      .string()
      .regex(/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/)
      .nullable(),
    amount: moneySchema.nullable(),
    note: z.string().trim().max(500).nullable(),
  })
  .strict();
export const movementWriteSchema = z
  .object({ expectedVersion: versionSchema, input: movementSchema })
  .strict();
export const movementCorrectionSchema = movementWriteSchema.extend({
  reason: z.string().trim().min(1).max(500),
});
export const assetReasonSchema = z
  .object({ expectedVersion: versionSchema, reason: z.string().trim().min(1).max(500) })
  .strict();
