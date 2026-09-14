import type { EffectivePeriod } from './calendar.js';

export function boundedEndMonth(
  input: EffectivePeriod,
  archivedFromMonth: string | null,
  oneOffMonth: string | null = null,
): string | null {
  const bounds = [input.endsOn?.slice(0, 7) ?? null, oneOffMonth];
  if (archivedFromMonth) {
    const year = Number(archivedFromMonth.slice(0, 4));
    const month = Number(archivedFromMonth.slice(5));
    bounds.push(month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`);
  }
  return bounds.filter((bound): bound is string => bound !== null).sort()[0] ?? null;
}
