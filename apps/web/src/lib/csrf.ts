import { queryClient } from '../app/query-client';
import { sessionKey } from '../features/auth/session';
import type { Session } from '../features/auth/session';
import { ApiError } from './api-error';

export function csrfHeaders(): { 'X-CSRF-Token': string } {
  const session = queryClient.getQueryData<Session | null>(sessionKey);
  if (!session) throw new ApiError('AUTH_REQUIRED');
  return { 'X-CSRF-Token': session.csrfToken };
}
