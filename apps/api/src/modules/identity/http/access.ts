import { SetMetadata, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { SessionRecord } from '../application/identity.ports.js';
import { IdentityError } from '../domain/identity-error.js';

export const PUBLIC_ROUTE = 'identity:public';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export type AuthenticatedRequest = FastifyRequest & { identitySession?: SessionRecord };

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionRecord => {
    const session = context.switchToHttp().getRequest<AuthenticatedRequest>().identitySession;
    if (!session) throw new IdentityError('AUTH_REQUIRED');
    return session;
  },
);
