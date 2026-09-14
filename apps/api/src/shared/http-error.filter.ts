import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const response = exception instanceof HttpException ? exception.getResponse() : undefined;
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
    void reply.status(status).send({ error: { code, requestId: request.id } });
  }
}
