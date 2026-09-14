import { describe, expect, it } from 'vitest';
import { readEnvironment } from '../src/shared/environment.js';

describe('API environment boundary', () => {
  it('rejects insecure production origins and trust-all proxy configuration', () => {
    expect(() =>
      readEnvironment({
        DATABASE_URL: 'postgresql://localhost/test',
        NODE_ENV: 'production',
        APP_ORIGIN: 'http://127.0.0.1:5173',
      }),
    ).toThrow('APP_ORIGIN');
    expect(() =>
      readEnvironment({ DATABASE_URL: 'postgresql://localhost/test', TRUST_PROXY: 'true' }),
    ).toThrow('TRUST_PROXY');
    expect(() =>
      readEnvironment({
        DATABASE_URL: 'postgresql://localhost/test',
        APP_ORIGIN: 'https://example.com/path',
      }),
    ).toThrow('APP_ORIGIN');
  });
  it('rejects missing database configuration without exposing other environment values', () => {
    expect(() => readEnvironment({ PRIVATE_KEY: 'sensitive-value' })).toThrow(
      'Invalid environment configuration: DATABASE_URL',
    );
  });

  it('rejects a non-PostgreSQL URL', () => {
    expect(() => readEnvironment({ DATABASE_URL: 'https://example.com/database' })).toThrow(
      'DATABASE_URL',
    );
  });

  it('rejects ports outside the TCP port range', () => {
    expect(() =>
      readEnvironment({ DATABASE_URL: 'postgresql://localhost/test', PORT: '65536' }),
    ).toThrow('PORT');
  });

  it('parses a valid explicit port without changing its database URL', () => {
    const environment = readEnvironment({
      DATABASE_URL: 'postgresql://localhost/test',
      PORT: '3010',
    });
    expect(environment.PORT).toBe(3010);
    expect(environment.DATABASE_URL).toBe('postgresql://localhost/test');
  });
});
