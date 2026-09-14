import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PasswordHasher, TokenCodec } from '../application/identity.ports.js';
import { IdentityError } from '../domain/identity-error.js';

const prefix = 'scrypt$131072$8$1';
const dummy = `${prefix}$${'0'.repeat(32)}$${'0'.repeat(128)}`;

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  private active = 0;

  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    if (this.active >= 2) throw new IdentityError('AUTH_BUSY');
    this.active += 1;
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password,
          salt,
          64,
          { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
          (error, key) => {
            if (error) reject(error);
            else resolve(key);
          },
        );
      });
    } finally {
      this.active -= 1;
    }
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.derive(password, salt);
    return `${prefix}$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  async verify(password: string, encoded: string | null): Promise<boolean> {
    const value = encoded ?? dummy;
    const match = /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(value);
    if (!match?.[1] || !match[2]) return false;
    const actual = await this.derive(password, Buffer.from(match[1], 'hex'));
    return timingSafeEqual(actual, Buffer.from(match[2], 'hex')) && encoded !== null;
  }
}

@Injectable()
export class NodeTokenCodec implements TokenCodec {
  create(): string {
    return randomBytes(32).toString('base64url');
  }
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  matches(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
