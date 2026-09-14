import { FinancialError } from './financial-error.js';

export interface Money {
  currency: 'EUR';
  minorUnits: string;
}
export const MAX_MINOR_UNITS = 999_999_999_999_999n;

export function cents(value: Money, nonnegative = true): bigint {
  if (
    value.currency !== 'EUR' ||
    !/^-?(0|[1-9]\d*)$/.test(value.minorUnits) ||
    value.minorUnits === '-0'
  )
    throw new FinancialError('INVALID_AMOUNT');
  const amount = BigInt(value.minorUnits);
  if (amount > MAX_MINOR_UNITS || amount < -MAX_MINOR_UNITS || (nonnegative && amount < 0n))
    throw new FinancialError('INVALID_AMOUNT');
  return amount;
}

export function money(amount: bigint): Money {
  const value: Money = { currency: 'EUR', minorUnits: amount.toString() };
  cents(value, false);
  return value;
}

export function decimal(value: string): { numerator: bigint; denominator: bigint } {
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/.test(value)) throw new FinancialError('INVALID_DECIMAL');
  const [whole = '0', fraction = ''] = value.split('.');
  return { numerator: BigInt(whole + fraction), denominator: 10n ** BigInt(fraction.length) };
}

export function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new FinancialError('INVALID_DECIMAL');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  return sign * ((absolute + denominator / 2n) / denominator);
}

export function applyRate(amount: bigint, value: string): bigint {
  const rate = decimal(value);
  if (rate.numerator > rate.denominator) throw new FinancialError('INVALID_DECIMAL');
  return roundRatio(amount * rate.numerator, rate.denominator);
}
