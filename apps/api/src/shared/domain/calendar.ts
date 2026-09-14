import { FinancialError } from './financial-error.js';

export function validMonth(value: string): string {
  if (!/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(value))
    throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
  return value;
}

export function daysInMonth(month: string): number {
  validMonth(month);
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5));
  if (number === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(number) ? 30 : 31;
}

export function validDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
  const day = Number(value.slice(8));
  if (day < 1 || day > daysInMonth(value.slice(0, 7)))
    throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
  return value;
}
export function reportedDate(value: string, today: string): string {
  validDate(value);
  if (value > today) throw new FinancialError('FUTURE_RECORD_DATE');
  return value;
}

export function dueDate(month: string, day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw new FinancialError('INVALID_DUE_SCHEDULE');
  return `${validMonth(month)}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;
}

export interface EffectivePeriod {
  effectiveFromMonth: string;
  startsOn: string;
  endsOn: string | null;
}
export interface Destination {
  accountId: string;
  spaceId: string | null;
}

export function validatePeriod(period: EffectivePeriod): void {
  validMonth(period.effectiveFromMonth);
  validDate(period.startsOn);
  if (
    period.endsOn &&
    (validDate(period.endsOn) < period.startsOn ||
      period.endsOn.slice(0, 7) < period.effectiveFromMonth)
  )
    throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
}

export function activeInMonth(period: EffectivePeriod, month: string): boolean {
  validatePeriod(period);
  validMonth(month);
  return (
    period.effectiveFromMonth <= month &&
    period.startsOn <= `${month}-${daysInMonth(month)}` &&
    (period.endsOn === null || period.endsOn >= `${month}-01`)
  );
}

export function withinDates(period: EffectivePeriod, date: string): boolean {
  return date >= period.startsOn && (period.endsOn === null || date <= period.endsOn);
}
