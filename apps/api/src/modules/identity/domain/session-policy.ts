export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1_000;
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1_000;

export function sessionIsActive(
  session: {
    expiresAt: Date;
    idleExpiresAt: Date;
    revokedAt: Date | null;
    credentialVersion: number;
  },
  currentCredentialVersion: number,
  now: Date,
): boolean {
  return (
    session.revokedAt === null &&
    session.expiresAt.getTime() > now.getTime() &&
    session.idleExpiresAt.getTime() > now.getTime() &&
    session.credentialVersion === currentCredentialVersion
  );
}

export function nextIdleExpiry(now: Date, absoluteExpiry: Date): Date {
  return new Date(Math.min(now.getTime() + SESSION_IDLE_MS, absoluteExpiry.getTime()));
}
