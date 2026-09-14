import { describe, expect, it } from 'vitest';
import { calculateIncome } from '../src/modules/income/domain/income.js';
import type { IncomeDefinition } from '../src/modules/income/domain/income.js';
import { projectCommitment } from '../src/modules/commitments/domain/commitment.js';
import type { CommitmentDefinition } from '../src/modules/commitments/domain/commitment.js';
import { activeInMonth, dueDate } from '../src/shared/domain/calendar.js';
import { money, roundRatio } from '../src/shared/domain/money.js';

const period = {
  name: 'Example',
  effectiveFromMonth: '2026-01',
  startsOn: '2026-01-01',
  endsOn: null,
  destination: { accountId: 'example-account', spaceId: null },
};
const professional: IncomeDefinition = {
  ...period,
  kind: 'professional',
  netSalary: null,
  base: money(100000n),
  hourlyRate: null,
  hours: null,
  vatRate: '0.21',
  withholdingRate: '0.15',
  commissionRate: '0.10',
};
const annual: CommitmentDefinition = {
  ...period,
  kind: 'fixed',
  frequency: 'annual',
  amount: money(10000n),
  dueDay: null,
  installments: [{ month: 11, day: 20, amount: money(10000n) }],
};

describe('Approved financial calculation policies', () => {
  it('separates expected cash, the VAT reserve, and spendable income', () => {
    const result = calculateIncome(professional);
    expect(result.expectedCash.minorUnits).toBe('96000');
    expect(result.taxReserve.minorUnits).toBe('21000');
    expect(result.spendableIncome.minorUnits).toBe('75000');
    expect(result.withholding.minorUnits).toBe('15000');
    expect(result.commission.minorUnits).toBe('10000');
  });
  it('rounds each exact half-cent component away from zero', () => {
    const result = calculateIncome({
      ...professional,
      base: money(5n),
      vatRate: '0.1',
      withholdingRate: '0',
      commissionRate: '0',
    });
    expect(result.vat.minorUnits).toBe('1');
    expect(result.expectedCash.minorUnits).toBe('6');
    expect(roundRatio(-5n, 10n)).toBe(-1n);
  });
  it('calculates hourly income without floating-point intermediates', () => {
    const result = calculateIncome({
      ...professional,
      base: null,
      hourlyRate: '20.005',
      hours: '8.25',
    });
    expect(result.base.minorUnits).toBe('16504');
    expect(result.vat.minorUnits).toBe('3466');
    expect(result.expectedCash.minorUnits).toBe('15844');
    expect(result.spendableIncome.minorUnits).toBe('12378');
  });
  it('uses an explicit net salary without gross-pay inference', () => {
    const result = calculateIncome({
      ...professional,
      kind: 'salary',
      netSalary: money(316000n),
      base: null,
      vatRate: '0',
      withholdingRate: '0',
      commissionRate: '0',
    });
    expect(result.expectedCash.minorUnits).toBe('316000');
    expect(result.taxReserve.minorUnits).toBe('0');
    expect(result.spendableIncome.minorUnits).toBe('316000');
  });
  it('preserves every cent across the full annual provision cycle', () => {
    const shares = Array.from(
      { length: 12 },
      (_, index) =>
        projectCommitment(annual, `2026-${String(index + 1).padStart(2, '0')}`).monthlyCharge
          .minorUnits,
    );
    expect(shares.slice(0, 4)).toEqual(['834', '834', '834', '834']);
    expect(shares.slice(4)).toEqual(Array(8).fill('833'));
    expect(shares.reduce((sum, amount) => sum + BigInt(amount), 0n)).toBe(10000n);
  });
  it('does not catch up previous months or deduct a due payment twice', () => {
    const input = {
      ...annual,
      amount: money(12000n),
      startsOn: '2026-10-15',
      installments: [{ month: 11, day: 20, amount: money(12000n) }],
    };
    expect(projectCommitment(input, '2026-09').monthlyCharge.minorUnits).toBe('0');
    expect(projectCommitment(input, '2026-10').monthlyCharge.minorUnits).toBe('1000');
    const november = projectCommitment(input, '2026-11');
    expect(november.monthlyCharge.minorUnits).toBe('1000');
    expect(november.duePayments).toEqual([{ date: '2026-11-20', amount: money(12000n) }]);
  });
  it('requires installment totals to match the annual obligation', () => {
    expect(() =>
      projectCommitment(
        { ...annual, installments: [{ month: 11, day: 20, amount: money(9000n) }] },
        '2026-11',
      ),
    ).toThrow('INSTALLMENT_TOTAL_MISMATCH');
  });
  it('handles inclusive validity and real calendar boundaries', () => {
    expect(
      activeInMonth({ ...period, startsOn: '2026-02-28', endsOn: '2026-02-28' }, '2026-02'),
    ).toBe(true);
    expect(dueDate('2026-02', 31)).toBe('2026-02-28');
    expect(dueDate('2028-02', 31)).toBe('2028-02-29');
    expect(() => activeInMonth({ ...period, startsOn: '2026-02-29' }, '2026-02')).toThrow(
      'INVALID_EFFECTIVE_PERIOD',
    );
  });
  it('rejects excess precision and conflicting income bases', () => {
    expect(() => calculateIncome({ ...professional, vatRate: '0.123456789' })).toThrow(
      'INVALID_DECIMAL',
    );
    expect(() => calculateIncome({ ...professional, hourlyRate: '10', hours: '2' })).toThrow(
      'INVALID_FINANCIAL_INPUT',
    );
  });
});
