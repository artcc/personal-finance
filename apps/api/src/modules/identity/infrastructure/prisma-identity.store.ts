import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database.service.js';
import type { Credential, Session } from '../../../generated/prisma/client.js';
import type {
  IdentityStore,
  SessionInput,
  SessionRecord,
  UserIdentity,
} from '../application/identity.ports.js';
import { IdentityError } from '../domain/identity-error.js';

function identity(credential: Credential): UserIdentity {
  return {
    id: credential.userId,
    email: credential.email,
    displayName: credential.displayName,
    credentialVersion: credential.version,
  };
}

function sessionRecord(session: Session & { credential: Credential }): SessionRecord {
  return {
    id: session.id,
    user: identity(session.credential),
    tokenHash: session.tokenHash,
    csrfToken: session.csrfToken,
    credentialVersion: session.credentialVersion,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    idleExpiresAt: session.idleExpiresAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
}

@Injectable()
export class PrismaIdentityStore implements IdentityStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async register(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<UserIdentity> {
    try {
      const user = await this.database.client.user.create({
        data: { credential: { create: input } },
        include: { credential: true },
      });
      if (!user.credential) throw new Error('Missing newly created credential');
      return identity(user.credential);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new IdentityError('REGISTRATION_FAILED');
      }
      throw error;
    }
  }

  async findCredential(email: string) {
    const credential = await this.database.client.credential.findUnique({ where: { email } });
    return credential ? { ...identity(credential), passwordHash: credential.passwordHash } : null;
  }

  async createSession(input: SessionInput): Promise<SessionRecord> {
    const session = await this.database.client.session.create({
      data: input,
      include: { credential: true },
    });
    return sessionRecord(session);
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const session = await this.database.client.session.findUnique({
      where: { tokenHash },
      include: { credential: true },
    });
    return session ? sessionRecord(session) : null;
  }

  async touchSession(session: SessionRecord, now: Date, idleExpiresAt: Date): Promise<boolean> {
    const result = await this.database.client.session.updateMany({
      where: {
        id: session.id,
        userId: session.user.id,
        revokedAt: null,
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
        credential: { version: session.credentialVersion },
      },
      data: { lastSeenAt: now, idleExpiresAt },
    });
    return result.count === 1;
  }

  async listSessions(
    userId: string,
    credentialVersion: number,
    now: Date,
  ): Promise<SessionRecord[]> {
    const sessions = await this.database.client.session.findMany({
      where: {
        userId,
        credentialVersion,
        revokedAt: null,
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { credential: true },
    });
    return sessions.map(sessionRecord);
  }

  async revokeSession(userId: string, sessionId: string, now: Date): Promise<boolean> {
    const result = await this.database.client.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count === 1;
  }

  async revokeAllSessions(userId: string, now: Date): Promise<void> {
    await this.database.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async resetPassword(email: string, passwordHash: string, now: Date): Promise<boolean> {
    return this.database.client.$transaction(async (transaction) => {
      const existing = await transaction.credential.findUnique({ where: { email } });
      if (!existing) return false;
      await transaction.credential.update({
        where: { userId: existing.userId },
        data: { passwordHash, version: { increment: 1 } },
      });
      await transaction.session.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  }

  async pruneSessions(now: Date): Promise<number> {
    const result = await this.database.client.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { not: null } },
          { expiresAt: { lte: now } },
          { idleExpiresAt: { lte: now } },
        ],
      },
    });
    return result.count;
  }
}
