import type { Destination, EffectivePeriod } from '../../../shared/domain/calendar.js';
import {
  activeInMonth,
  dueDate,
  validatePeriod,
  withinDates,
} from '../../../shared/domain/calendar.js';
import { cents, money } from '../../../shared/domain/money.js';
import type { Money } from '../../../shared/domain/money.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';

export interface Installment {
  month: number;
  day: number;
  amount: Money;
}
export interface CommitmentDefinition extends EffectivePeriod {
  name: string;
  destination: Destination;
  kind: 'fixed' | 'subscription' | 'professional' | 'shared' | 'financing' | 'investment';
  frequency: 'monthly' | 'annual';
  amount: Money;
  dueDay: number | null;
  installments: Installment[];
}
export interface CommitmentProjection {
  active: boolean;
  monthlyCharge: Money;
  duePayments: Array<{ date: string; amount: Money }>;
}

export function validateCommitment(input: CommitmentDefinition): void {
  validatePeriod(input);
  if (
    !input.name.trim() ||
    input.name.length > 120 ||
    !['fixed', 'subscription', 'professional', 'shared', 'financing', 'investment'].includes(
      input.kind,
    )
  )
    throw new FinancialError('INVALID_FINANCIAL_INPUT');
  const amount = cents(input.amount);
  if (input.frequency === 'monthly') {
    if (
      input.installments.length ||
      (input.dueDay !== null &&
        (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31))
    )
      throw new FinancialError('INVALID_DUE_SCHEDULE');
    return;
  }
  if (
    input.frequency !== 'annual' ||
    input.dueDay !== null ||
    input.installments.length > 24 ||
    (amount > 0n && input.installments.length === 0)
  )
    throw new FinancialError('INVALID_DUE_SCHEDULE');
  let total = 0n;
  for (const installment of input.installments) {
    if (
      !Number.isInteger(installment.month) ||
      installment.month < 1 ||
      installment.month > 12 ||
      !Number.isInteger(installment.day) ||
      installment.day < 1 ||
      installment.day > 31
    )
      throw new FinancialError('INVALID_DUE_SCHEDULE');
    total += cents(installment.amount);
  }
  if (total !== amount) throw new FinancialError('INSTALLMENT_TOTAL_MISMATCH');
}

export function projectCommitment(
  input: CommitmentDefinition,
  month: string,
): CommitmentProjection {
  validateCommitment(input);
  if (!activeInMonth(input, month))
    return { active: false, monthlyCharge: money(0n), duePayments: [] };
  const amount = cents(input.amount);
  if (input.frequency === 'monthly') {
    const date = input.dueDay === null ? null : dueDate(month, input.dueDay);
    return {
      active: true,
      monthlyCharge: money(amount),
      duePayments: date && withinDates(input, date) ? [{ date, amount: money(amount) }] : [],
    };
  }
  const monthIndex = Number(month.slice(5)) - 1;
  const provision = amount / 12n + (BigInt(monthIndex) < amount % 12n ? 1n : 0n);
  const payments = input.installments
    .filter((item) => item.month === monthIndex + 1)
    .map((item) => ({ date: dueDate(month, item.day), amount: item.amount }))
    .filter((item) => withinDates(input, item.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { active: true, monthlyCharge: money(provision), duePayments: payments };
}
