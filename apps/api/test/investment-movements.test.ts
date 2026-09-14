import { describe, expect, it } from 'vitest';
import { money } from '../src/shared/domain/money.js';
import {
  summarizeMovements,
  validateMovement,
} from '../src/modules/investments/domain/movements.js';
import type { Movement } from '../src/modules/investments/domain/movements.js';

function entry(
  id: string,
  kind: Movement['kind'],
  quantity: string | null,
  amount: bigint | null,
  sequence: number,
): Movement {
  return {
    id,
    kind,
    quantity,
    amount: amount === null ? null : money(amount),
    date: '2026-01-02',
    sequence,
    orderSequence: kind === 'opening' ? 0 : sequence,
    note: null,
    replacesId: null,
    voidedAt: null,
    voidReason: null,
  };
}
describe('Investment movements without cost-basis accounting', () => {
  it('preserves eight-place unit precision and reports cash flows rather than profit', () => {
    const result = summarizeMovements('units', [
      entry('buy', 'buy', '1.00000001', 10000n, 1),
      entry('sell', 'sell', '0.50000001', 7000n, 2),
    ]);
    expect(result.units).toBe('0.5');
    expect(result.moneyIn.minorUnits).toBe('10000');
    expect(result.moneyOut.minorUnits).toBe('7000');
    expect(result.netCashFlow.minorUnits).toBe('3000');
    expect(result).not.toHaveProperty('profit');
    expect(result).not.toHaveProperty('costBasis');
  });
  it('rejects sales without sufficient units at their date', () => {
    expect(() =>
      summarizeMovements('units', [
        entry('sell', 'sell', '1', 100n, 1),
        entry('buy', 'buy', '1', 100n, 2),
      ]),
    ).toThrow('INSUFFICIENT_UNITS');
  });
  it('keeps corrected same-day purchases in their original chronological position', () => {
    const previous = {
      ...entry('old', 'buy', '2', 20000n, 1),
      voidedAt: '2026-01-03T00:00:00Z',
      voidReason: 'Correction',
    };
    const corrected = {
      ...entry('new', 'buy', '3', 30000n, 3),
      orderSequence: 1,
      replacesId: 'old',
    };
    expect(
      summarizeMovements('units', [previous, entry('sale', 'sell', '1', 15000n, 2), corrected])
        .units,
    ).toBe('2');
  });
  it('keeps unknown opening capital explicit', () => {
    const result = summarizeMovements('units', [
      entry('opening', 'opening', '1', null, 2),
      entry('purchase', 'buy', '0.25', 1000n, 3),
    ]);
    expect(result.units).toBe('1.25');
    expect(result.openingCapitalUnknown).toBe(true);
    expect(result.moneyIn.minorUnits).toBe('1000');
  });
  it('does not reinterpret contributions as units or future plans as actual movements', () => {
    const contribution = entry('cash', 'contribution', null, 10000n, 1);
    expect(summarizeMovements('contributions', [contribution]).units).toBeNull();
    expect(() => validateMovement('units', contribution, '2026-01-02')).toThrow(
      'INVALID_INVESTMENT_INPUT',
    );
    expect(() =>
      validateMovement('contributions', { ...contribution, date: '2026-01-03' }, '2026-01-02'),
    ).toThrow('FUTURE_RECORD_DATE');
  });
  it('rejects duplicate or late openings', () => {
    expect(() =>
      summarizeMovements('units', [
        entry('one', 'opening', '1', null, 1),
        entry('two', 'opening', '1', null, 2),
      ]),
    ).toThrow('INVALID_OPENING_RECORD');
    expect(() =>
      summarizeMovements('units', [
        entry('buy', 'buy', '1', 100n, 1),
        { ...entry('opening', 'opening', '1', null, 2), date: '2026-01-03' },
      ]),
    ).toThrow('INVALID_OPENING_RECORD');
  });
});
