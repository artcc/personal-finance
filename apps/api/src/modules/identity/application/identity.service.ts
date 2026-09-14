import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_CLOCK, IDENTITY_STORE, PASSWORD_HASHER, TOKEN_CODEC } from './identity.ports.js';
import type {
  IdentityStore,
  PasswordHasher,
  TokenCodec,
  SessionRecord,
  UserIdentity,
} from './identity.ports.js';
import { IdentityError } from '../domain/identity-error.js';
import { SESSION_ABSOLUTE_MS, nextIdleExpiry, sessionIsActive } from '../domain/session-policy.js';

@Injectable()
export class IdentityService {
  constructor(
    @Inject(IDENTITY_STORE) private readonly store: IdentityStore,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(TOKEN_CODEC) private readonly tokens: TokenCodec,
    @Inject(IDENTITY_CLOCK) private readonly clock: () => Date,
  ) {}

  private async issueSession(
    user: UserIdentity,
  ): Promise<{ token: string; session: SessionRecord }> {
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    const token = this.tokens.create();
    const session = await this.store.createSession({
      userId: user.id,
      credentialVersion: user.credentialVersion,
      tokenHash: this.tokens.hash(token),
      csrfToken: this.tokens.create(),
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: nextIdleExpiry(now, expiresAt),
      expiresAt,
    });
    if (session.credentialVersion !== session.user.credentialVersion) {
      await this.store.revokeSession(user.id, session.id, now);
      throw new IdentityError('INVALID_CREDENTIALS');
    }
    return { token, session };
  }

  async register(input: { email: string; displayName: string; password: string }) {
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.store.register({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
    return this.issueSession(user);
  }

  async login(email: string, password: string) {
    const credential = await this.store.findCredential(email);
    const valid = await this.passwords.verify(password, credential?.passwordHash ?? null);
    if (!valid || !credential) throw new IdentityError('INVALID_CREDENTIALS');
    return this.issueSession(credential);
  }

  async authenticate(token: string | undefined): Promise<SessionRecord> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new IdentityError('AUTH_REQUIRED');
    const session = await this.store.findSession(this.tokens.hash(token));
    const now = this.clock();
    if (!session || !sessionIsActive(session, session.user.credentialVersion, now))
      throw new IdentityError('AUTH_REQUIRED');
    const idleExpiresAt = nextIdleExpiry(now, session.expiresAt);
    if (!(await this.store.touchSession(session, now, idleExpiresAt)))
      throw new IdentityError('AUTH_REQUIRED');
    return { ...session, lastSeenAt: now, idleExpiresAt };
  }

  requireCsrf(session: SessionRecord, token: unknown): void {
    if (typeof token !== 'string' || !this.tokens.matches(session.csrfToken, token))
      throw new IdentityError('CSRF_REJECTED');
  }

  listSessions(session: SessionRecord): Promise<SessionRecord[]> {
    return this.store.listSessions(session.user.id, session.user.credentialVersion, this.clock());
  }

  async revokeSession(session: SessionRecord, sessionId: string): Promise<void> {
    if (!(await this.store.revokeSession(session.user.id, sessionId, this.clock())))
      throw new IdentityError('SESSION_NOT_FOUND');
  }

  logoutAll(session: SessionRecord): Promise<void> {
    return this.store.revokeAllSessions(session.user.id, this.clock());
  }

  async resetPassword(email: string, password: string): Promise<boolean> {
    const passwordHash = await this.passwords.hash(password);
    return this.store.resetPassword(email, passwordHash, this.clock());
  }

  pruneSessions(): Promise<number> {
    return this.store.pruneSessions(this.clock());
  }
}
