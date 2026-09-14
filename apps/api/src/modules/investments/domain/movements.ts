import { reportedDate } from '../../../shared/domain/calendar.js';
import { cents, decimal, money } from '../../../shared/domain/money.js';
import type { Money } from '../../../shared/domain/money.js';

export type InvestmentMode = 'contributions' | 'units';
export type MovementKind = 'opening' | 'contribution' | 'withdrawal' | 'buy' | 'sell';
export class InvestmentError extends Error {
  constructor(
    readonly code: 'INVALID_INVESTMENT_INPUT' | 'INSUFFICIENT_UNITS' | 'INVALID_OPENING_RECORD',
  ) {
    super(code);
  }
}
export interface MovementInput {
  date: string;
  kind: MovementKind;
  quantity: string | null;
  amount: Money | null;
  note: string | null;
}
export interface Movement extends MovementInput {
  id: string;
  sequence: number;
  orderSequence: number;
  voidedAt: string | null;
  voidReason: string | null;
  replacesId: string | null;
}
export interface MovementSummary {
  units: string | null;
  moneyIn: Money;
  moneyOut: Money;
  netCashFlow: Money;
  openingCapitalUnknown: boolean;
  lastMovementDate: string | null;
}
const scale = 100_000_000n;
const maximum = 99_999_999_999_999_999_999n;
export function quantityAtoms(value: string): bigint {
  const parsed = decimal(value);
  return parsed.numerator * (scale / parsed.denominator);
}
export function quantityText(value: bigint): string {
  if (value < 0n || value > maximum) throw new InvestmentError('INVALID_INVESTMENT_INPUT');
  const fraction = (value % scale).toString().padStart(8, '0').replace(/0+$/, '');
  return `${value / scale}${fraction ? `.${fraction}` : ''}`;
}
export function validateMovement(mode: InvestmentMode, input: MovementInput, today: string): void {
  reportedDate(input.date, today);
  if (input.note !== null && input.note.length > 500)
    throw new InvestmentError('INVALID_INVESTMENT_INPUT');
  if (input.amount !== null) cents(input.amount);
  if (mode === 'units') {
    if (!['opening', 'buy', 'sell'].includes(input.kind) || input.quantity === null)
      throw new InvestmentError('INVALID_INVESTMENT_INPUT');
    const quantity = quantityAtoms(input.quantity);
    quantityText(quantity);
    if (input.kind !== 'opening' && (quantity === 0n || input.amount === null))
      throw new InvestmentError('INVALID_INVESTMENT_INPUT');
  } else {
    if (
      !['opening', 'contribution', 'withdrawal'].includes(input.kind) ||
      input.quantity !== null ||
      input.amount === null ||
      (input.kind !== 'opening' && cents(input.amount) === 0n)
    )
      throw new InvestmentError('INVALID_INVESTMENT_INPUT');
  }
}
export function summarizeMovements(mode: InvestmentMode, entries: Movement[]): MovementSummary {
  const active = entries
    .filter((entry) => entry.voidedAt === null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.orderSequence - b.orderSequence);
  const openings = active.filter((entry) => entry.kind === 'opening');
  if (openings.length > 1 || (openings[0] && active[0]?.id !== openings[0].id))
    throw new InvestmentError('INVALID_OPENING_RECORD');
  let units = 0n;
  let incoming = 0n;
  let outgoing = 0n;
  let unknown = false;
  for (const entry of active) {
    if (entry.kind === 'opening' && entry.amount === null) unknown = true;
    const amount = entry.amount === null ? 0n : cents(entry.amount);
    if (['withdrawal', 'sell'].includes(entry.kind)) outgoing += amount;
    else incoming += amount;
    if (mode === 'units') {
      if (entry.quantity === null) throw new InvestmentError('INVALID_INVESTMENT_INPUT');
      const quantity = quantityAtoms(entry.quantity);
      units += entry.kind === 'sell' ? -quantity : quantity;
      if (units < 0n) throw new InvestmentError('INSUFFICIENT_UNITS');
      quantityText(units);
    }
  }
  return {
    units: mode === 'units' ? quantityText(units) : null,
    moneyIn: money(incoming),
    moneyOut: money(outgoing),
    netCashFlow: money(incoming - outgoing),
    openingCapitalUnknown: unknown,
    lastMovementDate: active.at(-1)?.date ?? null,
  };
}
