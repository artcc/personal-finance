import { describe, expect, it } from 'vitest';
import { nextIdleExpiry, sessionIsActive } from '../src/modules/identity/domain/session-policy.js';

const now = new Date('2026-09-14T12:00:00Z');
const session = {
  expiresAt: new Date('2026-09-20T12:00:00Z'),
  idleExpiresAt: new Date('2026-09-14T18:00:00Z'),
  revokedAt: null,
  credentialVersion: 1,
};

describe('Session lifetime policy', () => {
  it('requires both expiry windows and the current credential version', () => {
    expect(sessionIsActive(session, 1, now)).toBe(true);
    expect(sessionIsActive(session, 2, now)).toBe(false);
    expect(sessionIsActive({ ...session, revokedAt: now }, 1, now)).toBe(false);
    expect(sessionIsActive({ ...session, idleExpiresAt: now }, 1, now)).toBe(false);
    expect(sessionIsActive({ ...session, expiresAt: now }, 1, now)).toBe(false);
  });

  it('does not extend inactivity expiry beyond the absolute limit', () => {
    const absolute = new Date('2026-09-14T13:00:00Z');
    expect(nextIdleExpiry(now, absolute)).toEqual(absolute);
  });
});
