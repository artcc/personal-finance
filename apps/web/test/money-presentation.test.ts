import { describe, expect, it } from 'vitest';
import {
  decimalInput,
  formatMoney,
  parseDecimalInput,
  parseMoneyInput,
} from '../src/features/finance/presentation';

describe('Exact Spanish financial input and presentation', () => {
  it('parses decimal commas and valid thousands groups exactly', () => {
    expect(parseMoneyInput('1.234,56')).toEqual({ currency: 'EUR', minorUnits: '123456' });
    expect(parseMoneyInput('0,01').minorUnits).toBe('1');
    expect(parseMoneyInput('000,00').minorUnits).toBe('0');
    expect(() => parseMoneyInput('1.23')).toThrow('invalidMoney');
    expect(() => parseMoneyInput('1,001')).toThrow('invalidMoney');
  });
  it('formats large amounts and negative sub-euro values without loss', () => {
    expect(formatMoney({ currency: 'EUR', minorUnits: '999999999999999' })).toContain(
      '9.999.999.999.999,99',
    );
    expect(formatMoney({ currency: 'EUR', minorUnits: '-1' })).toContain('-0,01');
  });
  it('converts percentage inputs to exact API fractions', () => {
    expect(parseDecimalInput('21', true)).toBe('0.21');
    expect(parseDecimalInput('0,000001', true)).toBe('0.00000001');
    expect(() => parseDecimalInput('100,01', true)).toThrow('invalidDecimal');
    expect(() => parseDecimalInput('0,0000001', true)).toThrow('invalidDecimal');
    expect(decimalInput('0.215', true)).toBe('21,5');
    expect(parseDecimalInput(decimalInput('0.00000001', true), true)).toBe('0.00000001');
    expect(parseDecimalInput(decimalInput('1.00000000', true), true)).toBe('1.00');
  });
});
