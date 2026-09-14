import { useQuery } from '@tanstack/react-query';
import type { components } from '@personal-finance/api-client';
import { api } from '../../lib/api';
import { clearPrivateQueries, notifySessionChanged, queryClient } from '../../app/query-client';
import { requireData } from '../../lib/api-error';

export type Session = components['schemas']['CurrentSessionDto'];
export const sessionKey = ['auth', 'session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async ({ signal }): Promise<Session | null> => {
      const result = await api.GET('/api/v1/auth/session', { signal });
      if (result.response.status === 401) return null;
      const next = requireData(result);
      const previous = queryClient.getQueryData<Session | null>(sessionKey);
      if (previous?.user.id !== next.user.id) clearPrivateQueries();
      return next;
    },
    staleTime: 60_000,
  });
}

export async function clearSession(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  queryClient.setQueryData(sessionKey, null);
  notifySessionChanged();
}
