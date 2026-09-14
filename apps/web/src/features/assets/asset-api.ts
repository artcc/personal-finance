import type { components } from '@personal-finance/api-client';
import { queryClient } from '../../app/query-client';

export type Financing = components['schemas']['FinancingDto'];
export type Investment = components['schemas']['InvestmentDto'];
export type Movement = components['schemas']['MovementDto'];
export type AssetKind = 'financing' | 'investments';
export function formatReportedDate(value: string, locale = 'es-ES'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
export async function refreshAssets(userId: string): Promise<void> {
  await queryClient.invalidateQueries({
    predicate: (query) =>
      [
        'financing',
        'investments',
        'asset-reports',
        'investment-entries',
        'investment-detail',
        'commitments',
        'commitments-detail',
      ].includes(String(query.queryKey[0])) && query.queryKey[1] === userId,
  });
}
