import { api } from '../../lib/api';
import { requireData, requireSuccess } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { queryClient } from '../../app/query-client';
import { clearSession, sessionKey } from './session';
import type { Session } from './session';

export async function login(input: { email: string; password: string }): Promise<Session> {
  return requireData(await api.POST('/api/v1/auth/login', { body: input }));
}

export async function register(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<Session> {
  return requireData(await api.POST('/api/v1/auth/register', { body: input }));
}

export async function logout(all = false): Promise<void> {
  const result = all
    ? await api.POST('/api/v1/auth/logout-all', { body: {}, params: { header: csrfHeaders() } })
    : await api.POST('/api/v1/auth/logout', { body: {}, params: { header: csrfHeaders() } });
  if (result.response.status !== 401) requireSuccess(result);
  await clearSession();
}

export async function revokeSession(id: string): Promise<void> {
  const current = queryClient.getQueryData<Session | null>(sessionKey);
  requireSuccess(
    await api.DELETE('/api/v1/auth/sessions/{id}', {
      params: { path: { id }, header: csrfHeaders() },
    }),
  );
  if (current?.sessionId === id) await clearSession();
  else await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
}
