import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../src/app/query-client';
import { clearSession, replaceSession, sessionKey } from '../src/features/auth/session';
import type { Session } from '../src/features/auth/session';

const session: Session = {
  user: { id: 'user-a', email: 'user-a@example.test', displayName: 'Example user' },
  sessionId: 'session-a',
  csrfToken: 'example-csrf-token',
  expiresAt: '2026-09-21T12:00:00.000Z',
  idleExpiresAt: '2026-09-15T00:00:00.000Z',
};

afterEach(() => {
  queryClient.clear();
});

describe('Observable authentication cache transitions', () => {
  it('notifies an already mounted guard of logout while discarding private cached data', async () => {
    queryClient.setQueryData<Session | null>(sessionKey, session);
    queryClient.setQueryData(['accounts', session.user.id], [{ name: 'Private account' }]);
    queryClient.setQueryData(['auth', 'sessions'], [{ id: session.sessionId }]);
    const observer = new QueryObserver<Session | null>(queryClient, {
      queryKey: sessionKey,
      enabled: false,
    });
    const observed: Array<Session | null | undefined> = [];
    const unsubscribe = observer.subscribe((result) => observed.push(result.data));
    try {
      await clearSession();
      expect(observer.getCurrentResult().data).toBeNull();
      expect(observed.at(-1)).toBeNull();
      expect(queryClient.getQueryData(['accounts', session.user.id])).toBeUndefined();
      expect(queryClient.getQueryData(['auth', 'sessions'])).toBeUndefined();
    } finally {
      unsubscribe();
      observer.destroy();
    }
  });

  it('notifies an existing signed-out observer when a user signs in', async () => {
    queryClient.setQueryData<Session | null>(sessionKey, null);
    const observer = new QueryObserver<Session | null>(queryClient, {
      queryKey: sessionKey,
      enabled: false,
    });
    const observed: Array<Session | null | undefined> = [];
    const unsubscribe = observer.subscribe((result) => observed.push(result.data));
    try {
      await replaceSession(session);
      expect(observer.getCurrentResult().data).toEqual(session);
      expect(observed.at(-1)).toEqual(session);
    } finally {
      unsubscribe();
      observer.destroy();
    }
  });
});
