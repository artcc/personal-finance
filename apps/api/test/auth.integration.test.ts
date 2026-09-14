import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/bootstrap.js';
import { DatabaseService } from '../dist/shared/database.service.js';
import { readEnvironment } from '../dist/shared/environment.js';
import { IdentityService } from '../dist/modules/identity/application/identity.service.js';
import type {
  CurrentSessionDto,
  ActiveSessionDto,
} from '../dist/modules/identity/http/auth.dto.js';

const url = process.env['TEST_DATABASE_URL'];
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error(
    'Authentication integration tests require a disposable TEST_DATABASE_URL ending in _test.',
  );
const origin = 'http://127.0.0.1:4173';
const environment = readEnvironment({ NODE_ENV: 'test', DATABASE_URL: url, APP_ORIGIN: origin });
const password = 'A long example password 42';
type LoginResult = { cookie: string; session: CurrentSessionDto };
let running: Awaited<ReturnType<typeof createApplication>>;
let first: LoginResult;
let second: LoginResult;

function result(response: { headers: Record<string, unknown>; json: <T>() => T }): LoginResult {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') throw new Error('Expected a session cookie');
  return { cookie: value.split(';')[0] ?? '', session: response.json<CurrentSessionDto>() };
}

async function signIn(email: string): Promise<LoginResult> {
  const response = await running.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { origin },
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  return result(response);
}

beforeAll(async () => {
  running = await createApplication(environment);
  const register = async (displayName: string): Promise<LoginResult> => {
    const response = await running.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin },
      payload: { displayName, email: `${randomUUID()}@example.test`, password },
    });
    expect(response.statusCode).toBe(201);
    return result(response);
  };
  first = await register('First user');
  second = await register('Second user');
}, 30_000);

afterAll(async () => {
  await running?.app.close();
});

describe('Registration and private session boundaries', () => {
  it('creates independent users and persists only session digests', async () => {
    expect(first.session.user.id).not.toBe(second.session.user.id);
    const database = running.app.get(DatabaseService);
    const stored = await database.client.session.findUniqueOrThrow({
      where: { id: first.session.sessionId },
    });
    const token = first.cookie.split('=')[1] ?? '';
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(first.session).not.toHaveProperty('tokenHash');
    expect(first.session.user).not.toHaveProperty('passwordHash');
    const credential = await database.client.credential.findUniqueOrThrow({
      where: { userId: first.session.user.id },
    });
    expect(credential.passwordHash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(credential.passwordHash).not.toContain(password);
  });

  it('uses the authenticated user rather than a supplied user ID', async () => {
    const response = await running.app.inject({
      method: 'GET',
      url: `/api/v1/auth/session?userId=${second.session.user.id}`,
      headers: { cookie: first.cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<CurrentSessionDto>().user.id).toBe(first.session.user.id);
  });

  it('does not allow one user to enumerate or revoke another user sessions', async () => {
    const list = await running.app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: { cookie: second.cookie },
    });
    expect(list.json<ActiveSessionDto[]>().map((item) => item.id)).not.toContain(
      first.session.sessionId,
    );
    const revoke = await running.app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/sessions/${first.session.sessionId}`,
      headers: { origin, cookie: second.cookie, 'x-csrf-token': second.session.csrfToken },
    });
    expect(revoke.statusCode).toBe(404);
    expect(revoke.json()).toMatchObject({ error: { code: 'SESSION_NOT_FOUND' } });
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: first.cookie },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('rejects missing or foreign Origin and invalid CSRF tokens', async () => {
    for (const requestOrigin of [undefined, 'https://untrusted.example']) {
      const headers: Record<string, string> = {
        cookie: first.cookie,
        'x-csrf-token': first.session.csrfToken,
      };
      if (requestOrigin) headers['origin'] = requestOrigin;
      const response = await running.app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers,
        payload: {},
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'ORIGIN_REJECTED' } });
    }
    const response = await running.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin, cookie: first.cookie, 'x-csrf-token': 'wrong-token' },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'CSRF_REJECTED' } });
  });

  it('rejects tampered and idle-expired sessions', async () => {
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: `pf_session=${'x'.repeat(43)}` },
        })
      ).statusCode,
    ).toBe(401);
    const expired = await signIn(first.session.user.email);
    await running.app.get(DatabaseService).client.session.update({
      where: { id: expired.session.sessionId },
      data: { idleExpiresAt: new Date(0) },
    });
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: expired.cookie },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('rejects concurrent registration of the same normalized email', async () => {
    const email = `${randomUUID()}@example.test`;
    const responses = await Promise.all(
      [email, email.toUpperCase()].map((value) =>
        running.app.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: { origin },
          payload: { email: value, displayName: 'Concurrent account', password },
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(
      await running.app.get(DatabaseService).client.credential.count({ where: { email } }),
    ).toBe(1);
  });

  it('returns the same error for an unknown email and a wrong password', async () => {
    for (const email of [`${randomUUID()}@example.test`, first.session.user.email]) {
      const response = await running.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin },
        payload: { email, password: 'An incorrect password 99' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
    }
  });

  it('logs out one account without revoking another account', async () => {
    const response = await running.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout-all',
      headers: { origin, cookie: first.cookie, 'x-csrf-token': first.session.csrfToken },
      payload: {},
    });
    expect(response.statusCode).toBe(204);
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: first.cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: second.cookie },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('invalidates sessions after password recovery only for the targeted account', async () => {
    const active = await signIn(first.session.user.email);
    expect(
      await running.app
        .get(IdentityService)
        .resetPassword(first.session.user.email, 'An updated account password 77'),
    ).toBe(true);
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: active.cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await running.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: second.cookie },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('applies production cookie flags', async () => {
    const production = await createApplication(
      readEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: url,
        APP_ORIGIN: 'https://finance.example.test',
      }),
    );
    try {
      const response = await production.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'https://finance.example.test' },
        payload: { email: second.session.user.email, password },
      });
      expect(response.statusCode).toBe(200);
      const header = String(response.headers['set-cookie']);
      expect(header).toContain('__Host-pf_session=');
      expect(header).toContain('HttpOnly');
      expect(header).toContain('Secure');
      expect(header).toContain('SameSite=Strict');
      expect(header).toContain('Path=/');
      expect(header).not.toContain('Domain=');
    } finally {
      await production.app.close();
    }
  });

  it('returns a safe rate-limit response before doing expensive work', async () => {
    const limited = await createApplication(environment);
    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect(
          (
            await limited.app.inject({
              method: 'POST',
              url: '/api/v1/auth/register',
              headers: { origin },
              payload: {},
            })
          ).statusCode,
        ).toBe(422);
      }
      const response = await limited.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { origin },
        payload: {},
      });
      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({ error: { code: 'AUTH_RATE_LIMITED' } });
      expect(response.headers).toHaveProperty('retry-after');
    } finally {
      await limited.app.close();
    }
  });
});
