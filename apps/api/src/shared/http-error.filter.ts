import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { IdentityError } from '../modules/identity/domain/identity-error.js';
import type { IdentityErrorCode } from '../modules/identity/domain/identity-error.js';
import { FinancialError } from './domain/financial-error.js';
import { PlanError } from '../modules/planning/domain/plan.js';
import { InvestmentError } from '../modules/investments/domain/movements.js';
import { DataFileError } from '../modules/data-portability/application/document.js';

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
      exception instanceof DataFileError
        ? exception.code === 'DATA_FILE_TOO_LARGE'
          ? 413
          : ['IMPORT_REQUIRES_EMPTY_WORKSPACE', 'IMPORT_PREVIEW_CHANGED'].includes(exception.code)
            ? 409
            : 422
        : exception instanceof InvestmentError
          ? 422
          : exception instanceof PlanError
            ? exception.code.endsWith('_NOT_FOUND')
              ? 404
              : ['PLAN_READ_ONLY', 'PLAN_VERSION_CONFLICT', 'PLAN_REFRESH_CONFLICT'].includes(
                    exception.code,
                  )
                ? 409
                : 422
            : exception instanceof FinancialError
              ? exception.code.endsWith('_NOT_FOUND')
                ? 404
                : [
                      'VERSION_CONFLICT',
                      'ARCHIVE_PREVIEW_CONFLICT',
                      'DESTINATION_IN_USE',
                      'RESOURCE_ARCHIVED',
                      'PLANNING_SOURCE_LINKED',
                      'LINKED_SOURCE_KIND_MISMATCH',
                    ].includes(exception.code)
                  ? 409
                  : 422
              : exception instanceof IdentityError
                ? identityStatus[exception.code]
                : exception instanceof HttpException
                  ? exception.getStatus()
                  : 500;
    const response =
      exception instanceof IdentityError ||
      exception instanceof FinancialError ||
      exception instanceof PlanError ||
      exception instanceof InvestmentError ||
      exception instanceof DataFileError
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
