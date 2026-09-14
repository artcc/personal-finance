import type { Destination, EffectivePeriod } from '../../../shared/domain/calendar.js';
import { validatePeriod } from '../../../shared/domain/calendar.js';
import { applyRate, cents, decimal, money, roundRatio } from '../../../shared/domain/money.js';
import type { Money } from '../../../shared/domain/money.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';

export interface IncomeDefinition extends EffectivePeriod {
  name: string;
  destination: Destination;
  kind: 'salary' | 'professional';
  netSalary: Money | null;
  base: Money | null;
  hourlyRate: string | null;
  hours: string | null;
  vatRate: string;
  withholdingRate: string;
  commissionRate: string;
}

export interface IncomeCalculation {
  base: Money;
  vat: Money;
  withholding: Money;
  commission: Money;
  expectedCash: Money;
  taxReserve: Money;
  spendableIncome: Money;
}

export function calculateIncome(input: IncomeDefinition): IncomeCalculation {
  validatePeriod(input);
  if (!input.name.trim() || input.name.length > 120)
    throw new FinancialError('INVALID_FINANCIAL_INPUT');
  if (input.kind === 'salary') {
    if (
      !input.netSalary ||
      input.base !== null ||
      input.hourlyRate !== null ||
      input.hours !== null ||
      [input.vatRate, input.withholdingRate, input.commissionRate].some(
        (rate) => decimal(rate).numerator !== 0n,
      )
    )
      throw new FinancialError('INVALID_FINANCIAL_INPUT');
    const net = money(cents(input.netSalary));
    return {
      base: net,
      vat: money(0n),
      withholding: money(0n),
      commission: money(0n),
      expectedCash: net,
      taxReserve: money(0n),
      spendableIncome: net,
    };
  }
  if (input.kind !== 'professional' || input.netSalary !== null)
    throw new FinancialError('INVALID_FINANCIAL_INPUT');
  let base: bigint;
  if (input.base !== null) {
    if (input.hourlyRate !== null || input.hours !== null)
      throw new FinancialError('INVALID_FINANCIAL_INPUT');
    base = cents(input.base);
  } else {
    if (input.hourlyRate === null || input.hours === null)
      throw new FinancialError('INVALID_FINANCIAL_INPUT');
    const rate = decimal(input.hourlyRate);
    const hours = decimal(input.hours);
    base = roundRatio(
      rate.numerator * hours.numerator * 100n,
      rate.denominator * hours.denominator,
    );
  }
  const vat = applyRate(base, input.vatRate);
  const withholding = applyRate(base, input.withholdingRate);
  const commission = applyRate(base, input.commissionRate);
  const expectedCash = base + vat - withholding - commission;
  if (expectedCash < 0n) throw new FinancialError('INVALID_RECEIPT_AMOUNT');
  return {
    base: money(base),
    vat: money(vat),
    withholding: money(withholding),
    commission: money(commission),
    expectedCash: money(expectedCash),
    taxReserve: money(vat),
    spendableIncome: money(expectedCash - vat),
  };
}
