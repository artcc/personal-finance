import { z } from 'zod';
import { FinancialError } from '../domain/financial-error.js';

export const moneySchema = z
  .object({ currency: z.literal('EUR'), minorUnits: z.string().regex(/^(0|[1-9]\d{0,14})$/) })
  .strict();
export const destinationSchema = z
  .object({ accountId: z.uuid(), spaceId: z.uuid().nullable() })
  .strict();
const period = {
  name: z.string().trim().min(1).max(120),
  effectiveFromMonth: z.string().length(7),
  startsOn: z.string().length(10),
  endsOn: z.string().length(10).nullable(),
  destination: destinationSchema,
};
const exactDecimal = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/);
export const incomeDefinitionSchema = z
  .object({
    ...period,
    kind: z.enum(['salary', 'professional']),
    netSalary: moneySchema.nullable(),
    base: moneySchema.nullable(),
    hourlyRate: exactDecimal.nullable(),
    hours: exactDecimal.nullable(),
    vatRate: exactDecimal,
    withholdingRate: exactDecimal,
    commissionRate: exactDecimal,
  })
  .strict();
export const commitmentDefinitionSchema = z
  .object({
    ...period,
    kind: z.enum(['fixed', 'subscription', 'professional', 'shared', 'financing', 'investment']),
    frequency: z.enum(['monthly', 'annual']),
    amount: moneySchema,
    dueDay: z.number().int().min(1).max(31).nullable(),
    installments: z
      .array(
        z
          .object({
            month: z.number().int().min(1).max(12),
            day: z.number().int().min(1).max(31),
            amount: moneySchema,
          })
          .strict(),
      )
      .max(24),
  })
  .strict();
export const accountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    institution: z.string().trim().max(120).nullable(),
    reference: z.string().trim().max(120).nullable(),
    currency: z.literal('EUR'),
  })
  .strict();
export const versionSchema = z.number().int().min(1).max(2_147_483_646);
export const archiveSchema = z
  .object({
    expectedVersion: versionSchema,
    archivedFromMonth: z.string().length(7),
    spaceIds: z.array(z.uuid()).max(100),
  })
  .strict();
export const sourceArchiveSchema = z
  .object({ expectedVersion: versionSchema, archivedFromMonth: z.string().length(7) })
  .strict();
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(120).default(''),
    includeArchived: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    month: z.string().length(7).optional(),
  })
  .strict();
export type ListInput = z.output<typeof listSchema>;
export const sourceListSchema = listSchema.extend({
  kind: z
    .enum([
      'all',
      'salary',
      'professional',
      'fixed',
      'subscription',
      'shared',
      'financing',
      'investment',
    ])
    .default('all'),
  accountId: z.union([z.uuid(), z.literal('')]).default(''),
});
export type SourceListInput = z.output<typeof sourceListSchema>;

export function parseFinancial<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new FinancialError('INVALID_FINANCIAL_INPUT');
  return result.data;
}
export function resourceId(value: string): string {
  return parseFinancial(z.uuid(), value);
}
