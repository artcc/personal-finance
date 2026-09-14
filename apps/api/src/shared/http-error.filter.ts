import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { IdentityError } from '../modules/identity/domain/identity-error.js';
import type { IdentityErrorCode } from '../modules/identity/domain/identity-error.js';

const identityStatus: Record<IdentityErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  REGISTRATION_FAILED: 409,
  AUTH_REQUIRED: 401,
  CSRF_REJECTED: 403,
  AUTH_BUSY: 429,
  SESSION_NOT_FOUND: 404,
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status =
      exception instanceof IdentityError
        ? identityStatus[exception.code]
        : exception instanceof HttpException
          ? exception.getStatus()
          : 500;
    const response =
      exception instanceof IdentityError
        ? { code: exception.code }
        : exception instanceof HttpException
          ? exception.getResponse()
          : undefined;
    const publicCode =
      typeof response === 'object' && response !== null && 'code' in response
        ? response.code
        : undefined;
    const code =
      typeof publicCode === 'string' && /^[A-Z][A-Z0-9_]*$/.test(publicCode)
        ? publicCode
        : status === 404
          ? 'RESOURCE_NOT_FOUND'
          : status >= 500
            ? 'INTERNAL_ERROR'
            : 'REQUEST_REJECTED';

    if (status >= 500) request.log.error({ code, requestId: request.id }, 'Request failed');
    if (status === 429) reply.header('Retry-After', '1');
    void reply.status(status).send({ error: { code, requestId: request.id } });
  }
}
