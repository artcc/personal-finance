export const IDENTITY_STORE = Symbol('IDENTITY_STORE');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const TOKEN_CODEC = Symbol('TOKEN_CODEC');
export const IDENTITY_CLOCK = Symbol('IDENTITY_CLOCK');

export interface UserIdentity {
  id: string;
  email: string;
  displayName: string;
  credentialVersion: number;
}

export interface CredentialRecord extends UserIdentity {
  passwordHash: string;
}

export interface SessionRecord {
  id: string;
  user: UserIdentity;
  tokenHash: string;
  csrfToken: string;
  credentialVersion: number;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionInput {
  userId: string;
  credentialVersion: number;
  tokenHash: string;
  csrfToken: string;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  expiresAt: Date;
}

export interface IdentityStore {
  register(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<UserIdentity>;
  findCredential(email: string): Promise<CredentialRecord | null>;
  createSession(input: SessionInput): Promise<SessionRecord>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(session: SessionRecord, now: Date, idleExpiresAt: Date): Promise<boolean>;
  listSessions(userId: string, credentialVersion: number, now: Date): Promise<SessionRecord[]>;
  revokeSession(userId: string, sessionId: string, now: Date): Promise<boolean>;
  revokeAllSessions(userId: string, now: Date): Promise<void>;
  resetPassword(email: string, passwordHash: string, now: Date): Promise<boolean>;
  pruneSessions(now: Date): Promise<number>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encoded: string | null): Promise<boolean>;
}

export interface TokenCodec {
  create(): string;
  hash(token: string): string;
  matches(left: string, right: string): boolean;
}
