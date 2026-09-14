import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import { ENVIRONMENT } from '../../../shared/environment.js';
import type { Environment } from '../../../shared/environment.js';
import { IdentityService } from '../application/identity.service.js';
import { PUBLIC_ROUTE } from './access.js';
import type { AuthenticatedRequest } from './access.js';
import { sessionCookieName } from './session-cookie.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutation) {
      if (request.headers.origin !== this.environment.APP_ORIGIN)
        throw new ForbiddenException({ code: 'ORIGIN_REJECTED' });
      if (
        request.method !== 'DELETE' &&
        request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json'
      ) {
        throw new ForbiddenException({ code: 'ORIGIN_REJECTED' });
      }
    }
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    reply.header('Cache-Control', 'no-store');
    const session = await this.identity.authenticate(
      request.cookies[sessionCookieName(this.environment)],
    );
    if (mutation) this.identity.requireCsrf(session, request.headers['x-csrf-token']);
    request.identitySession = session;
    return true;
  }
}
