import type { components } from '@personal-finance/api-client';
export type Money = components['schemas']['MoneyDto'];

export function parseMoneyInput(value: string): Money {
  const text = value.trim();
  if (!/^(\d+|[1-9]\d{0,2}(\.\d{3})+)(,\d{1,2})?$/.test(text)) throw new Error('invalidMoney');
  const [whole = '0', fraction = ''] = text.replaceAll('.', '').split(',');
  const minorUnits = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
  if (minorUnits.length > 15) throw new Error('invalidMoney');
  return { currency: 'EUR', minorUnits };
}

export function moneyInput(value: Money | null): string {
  if (value === null) return '';
  const cents = BigInt(value.minorUnits);
  return `${cents / 100n},${(cents % 100n).toString().padStart(2, '0')}`;
}

export function formatMoney(value: Money, locale = 'es-ES'): string {
  const cents = BigInt(value.minorUnits);
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const signedWhole = cents < 0n ? (whole === 0n ? -0 : -whole) : whole;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    useGrouping: 'always',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(signedWhole)
    .map((part) =>
      part.type === 'fraction' ? (absolute % 100n).toString().padStart(2, '0') : part.value,
    )
    .join('');
}

export function parseDecimalInput(value: string, percent = false): string {
  const text = value.trim();
  if (!/^(\d+|[1-9]\d{0,2}(\.\d{3})+)(,\d{1,8})?$/.test(text)) throw new Error('invalidDecimal');
  const [whole = '0', fraction = ''] = text.replaceAll('.', '').split(',');
  const scale = fraction.length + (percent ? 2 : 0);
  if (
    scale > 8 ||
    whole.length > 12 ||
    (percent && BigInt(whole + fraction) > 100n * 10n ** BigInt(fraction.length))
  )
    throw new Error('invalidDecimal');
  const digits = BigInt(whole + fraction)
    .toString()
    .padStart(scale + 1, '0');
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function decimalInput(value: string | null, percent = false): string {
  if (value === null) return '';
  const [whole = '0', fraction = ''] = value.split('.');
  if (!percent) return value.replace('.', ',');
  const digits = (BigInt(whole + fraction) * 100n).toString().padStart(fraction.length + 1, '0');
  if (fraction.length === 0) return digits;
  const fractional = digits.slice(-fraction.length).replace(/0+$/, '');
  const integer = digits.slice(0, -fraction.length);
  return fractional ? `${integer},${fractional}` : integer;
}
