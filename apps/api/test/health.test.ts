import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../dist/bootstrap.js';
import { DatabaseService } from '../dist/shared/database.service.js';
import { readEnvironment } from '../dist/shared/environment.js';

let running: Awaited<ReturnType<typeof createApplication>> | undefined;

async function application() {
  running = await createApplication(
    readEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
    }),
  );
  return running.app;
}

afterEach(async () => {
  await running?.app.close();
  running = undefined;
});

describe('Health HTTP contract', () => {
  it('reports liveness without querying PostgreSQL', async () => {
    const ping = vi.spyOn(DatabaseService.prototype, 'ping');
    const app = await application();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports readiness only after a successful database check', async () => {
    const ping = vi.spyOn(DatabaseService.prototype, 'ping').mockResolvedValue();
    const app = await application();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'available' });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('returns a safe error code and request ID when PostgreSQL fails', async () => {
    vi.spyOn(DatabaseService.prototype, 'ping').mockRejectedValue(
      new Error('password=private-value'),
    );
    const app = await application();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: { code: 'DATABASE_UNAVAILABLE', requestId: expect.any(String) },
    });
    expect(response.body).not.toContain('private-value');
  });
});
