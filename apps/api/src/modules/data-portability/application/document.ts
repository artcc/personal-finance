import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  incomeDefinitionSchema,
  commitmentDefinitionSchema,
} from '../../../shared/application/financial-input.js';
import { snapshotSchema, summarySchema } from '../../planning/application/planning.schemas.js';

export const DATA_FORMAT = 'personal-finance';
export const DATA_VERSION = 1;
export const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
export const MAX_DOCUMENT_ROWS = 50000;
export class DataFileError extends Error {
  constructor(
    readonly code:
      | 'INVALID_DATA_FILE'
      | 'INCOMPATIBLE_DATA_FILE'
      | 'DATA_FILE_TOO_LARGE'
      | 'IMPORT_REQUIRES_EMPTY_WORKSPACE'
      | 'IMPORT_PREVIEW_CHANGED',
  ) {
    super(code);
  }
}
const id = z.uuid();
const version = z.number().int().min(1).max(2147483646);
const timestamp = z.iso.datetime({ offset: true });
const date = z.iso.date();
const month = z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/);
const cents = z.string().regex(/^(0|[1-9]\d{0,14})$/);
const signedCents = z.string().regex(/^-?(0|[1-9]\d{0,14})$/);
const decimal = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/);
const name = z.string().min(1).max(120);
const revisions = {
  id,
  sourceId: id,
  version,
  name,
  effectiveFromMonth: month,
  startsOn: date,
  endsOn: date.nullable(),
  accountId: id,
  spaceId: id.nullable(),
  createdAt: timestamp,
};
const tables = {
  accounts: z.array(
    z
      .object({
        id,
        name,
        institution: z.string().max(120).nullable(),
        reference: z.string().max(120).nullable(),
        currency: z.literal('EUR'),
        archivedFromMonth: month.nullable(),
        version,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .strict(),
  ),
  spaces: z.array(
    z.object({ id, accountId: id, name, archivedFromMonth: month.nullable(), version }).strict(),
  ),
  incomeSources: z.array(
    z
      .object({
        id,
        recurrence: z.enum(['monthly', 'once']),
        oneOffMonth: month.nullable(),
        archivedFromMonth: month.nullable(),
        version,
      })
      .strict(),
  ),
  incomeRevisions: z.array(
    z
      .object({
        ...revisions,
        input: incomeDefinitionSchema,
        baseCents: cents,
        vatCents: cents,
        withholdingCents: cents,
        commissionCents: cents,
        cashCents: cents,
        reserveCents: cents,
        spendableCents: signedCents,
        vatRate: decimal,
        withholdingRate: decimal,
        commissionRate: decimal,
        hourlyRate: decimal.nullable(),
        hours: decimal.nullable(),
        calculationVersion: z.literal('income-v1'),
      })
      .strict(),
  ),
  commitmentSources: z.array(
    z.object({ id, archivedFromMonth: month.nullable(), version }).strict(),
  ),
  commitmentRevisions: z.array(
    z
      .object({
        ...revisions,
        input: commitmentDefinitionSchema,
        amountCents: cents,
        calculationVersion: z.literal('commitment-v1'),
      })
      .strict(),
  ),
  commitmentInstallments: z.array(
    z
      .object({
        revisionId: id,
        ordinal: z.number().int().min(0).max(23),
        month: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(31),
        amountCents: cents,
      })
      .strict(),
  ),
  financings: z.array(
    z
      .object({
        id,
        planningSourceId: id,
        name,
        lender: z.string().max(120).nullable(),
        originalPrincipalCents: cents.nullable(),
        version,
        createdAt: timestamp,
      })
      .strict(),
  ),
  financingBalances: z.array(
    z
      .object({
        id,
        financingId: id,
        sequence: version,
        asOf: date,
        amountCents: cents,
        createdAt: timestamp,
      })
      .strict(),
  ),
  investments: z.array(
    z
      .object({
        id,
        planningSourceId: id.nullable(),
        name,
        platform: z.string().max(120).nullable(),
        ticker: z.string().max(30).nullable(),
        kind: z.enum(['fund', 'pension', 'crypto', 'other']),
        mode: z.enum(['contributions', 'units']),
        version,
        createdAt: timestamp,
      })
      .strict(),
  ),
  investmentEntries: z.array(
    z
      .object({
        id,
        investmentId: id,
        sequence: version,
        orderSequence: z.number().int().min(0).max(2147483646),
        date,
        kind: z.enum(['opening', 'contribution', 'withdrawal', 'buy', 'sell']),
        quantity: decimal.nullable(),
        amountCents: cents.nullable(),
        note: z.string().max(500).nullable(),
        replacesId: id.nullable(),
        voidedAt: timestamp.nullable(),
        voidReason: z.string().min(1).max(500).nullable(),
        createdAt: timestamp,
      })
      .strict(),
  ),
  investmentValuations: z.array(
    z
      .object({
        id,
        investmentId: id,
        sequence: version,
        asOf: date,
        amountCents: cents,
        createdAt: timestamp,
      })
      .strict(),
  ),
  monthlyPlans: z.array(
    z.object({ id, month, currentRevision: version, version, createdAt: timestamp }).strict(),
  ),
  monthlyPlanRevisions: z.array(
    z
      .object({
        id,
        planId: id,
        number: version,
        version,
        state: z.enum(['draft', 'closed']),
        snapshot: snapshotSchema,
        summary: summarySchema,
        expectedCashCents: cents,
        taxReserveCents: cents,
        chargesCents: cents,
        availabilityCents: signedCents,
        allocatedCashCents: cents,
        fundingGapCents: cents,
        reopenReason: z.string().min(1).max(500).nullable(),
        createdAt: timestamp,
        updatedAt: timestamp,
        closedAt: timestamp.nullable(),
      })
      .strict(),
  ),
  financialEvents: z.array(
    z
      .object({
        id,
        entityType: z.string().min(1).max(32),
        entityId: id,
        action: z.string().min(1).max(32),
        payload: z.record(z.string(), z.unknown()),
        createdAt: timestamp,
      })
      .strict(),
  ),
};
export const documentSchema = z
  .object({
    format: z.literal(DATA_FORMAT),
    formatVersion: z.literal(DATA_VERSION),
    exportedAt: timestamp,
    currency: z.literal('EUR'),
    moneyEncoding: z.literal('integer-cents-as-strings'),
    data: z.object(tables).strict(),
  })
  .strict();
export type FinancialDocument = z.output<typeof documentSchema>;
export type FinancialData = FinancialDocument['data'];
export type TableName = keyof FinancialData;
export const tableNames = Object.keys(tables) as TableName[];
export function documentCounts(document: FinancialDocument): Record<string, number> {
  return Object.fromEntries(tableNames.map((key) => [key, document.data[key].length]));
}
export function canonical(value: unknown): string {
  const order = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(order)
      : item !== null && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, nested]) => [key, order(nested)]),
          )
        : item;
  return JSON.stringify(order(value)) ?? 'null';
}
export function fingerprint(document: FinancialDocument): string {
  return createHash('sha256').update(canonical(document)).digest('hex');
}
export function parseDocument(value: unknown): FinancialDocument {
  if (
    !value ||
    typeof value !== 'object' ||
    !('format' in value) ||
    value.format !== DATA_FORMAT ||
    !('formatVersion' in value) ||
    value.formatVersion !== DATA_VERSION
  )
    throw new DataFileError('INCOMPATIBLE_DATA_FILE');
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success) throw new DataFileError('INVALID_DATA_FILE');
  // Reject unrecognized fields or implicit normalization instead of silently losing data.
  if (canonical(value) !== canonical(parsed.data)) throw new DataFileError('INVALID_DATA_FILE');
  if (
    tableNames.reduce((sum, key) => sum + parsed.data.data[key].length, 0) > MAX_DOCUMENT_ROWS ||
    Buffer.byteLength(JSON.stringify(parsed.data), 'utf8') > MAX_DOCUMENT_BYTES
  )
    throw new DataFileError('DATA_FILE_TOO_LARGE');
  return parsed.data;
}
export function exportText(document: FinancialDocument): string {
  const text = `${JSON.stringify(document, null, 2)}\n`;
  if (Buffer.byteLength(text, 'utf8') > MAX_DOCUMENT_BYTES)
    throw new DataFileError('DATA_FILE_TOO_LARGE');
  return text;
}
