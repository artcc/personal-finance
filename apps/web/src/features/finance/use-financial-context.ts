import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';

export function useFinancialContext(userId: string) {
  return useQuery({
    queryKey: ['financial-context', userId],
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/api/v1/financial-context', { signal })),
  });
}
