import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Environment } from './shared/environment.js';
import { HttpErrorFilter } from './shared/http-error.filter.js';
import { sessionCookieName } from './modules/identity/http/session-cookie.js';

export async function createApplication(
  environment: Environment,
): Promise<{ app: NestFastifyApplication; document: OpenAPIObject }> {
  const adapter = new FastifyAdapter({
    logger: environment.NODE_ENV !== 'test',
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    trustProxy: environment.TRUST_PROXY,
    bodyLimit: 32_768,
  });
  const server = adapter.getInstance<FastifyInstance>();
  server.register(cookie);
  server.register(rateLimit, { global: false });
  const limiters = new Map<string, ReturnType<FastifyInstance['createRateLimit']>>();
  server.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url ?? '';
    if (route.startsWith('/api/v1/auth/')) reply.header('Cache-Control', 'no-store');
    if (
      request.method !== 'POST' ||
      !['/api/v1/auth/register', '/api/v1/auth/login'].includes(route)
    )
      return;
    let limiter = limiters.get(route);
    if (!limiter) {
      limiter = server.createRateLimit({
        max: 10,
        timeWindow: route.endsWith('/register') ? 3_600_000 : 900_000,
      });
      limiters.set(route, limiter);
    }
    const result = await limiter(request);
    if (!result.isAllowed && result.isExceeded) {
      reply.header('Retry-After', result.ttlInSeconds);
      return reply.code(429).send({ error: { code: 'AUTH_RATE_LIMITED', requestId: request.id } });
    }
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(environment),
    adapter,
    { logger: environment.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'] },
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Personal Finance API')
      .setDescription('Private monthly financial planner API')
      .setVersion('1.0.0')
      .addCookieAuth(sessionCookieName(environment), { type: 'apiKey', in: 'cookie' }, 'session')
      .build(),
  );
  // JSON documentation is sufficient for the foundation and requires no UI assets.
  if (environment.NODE_ENV === 'development') {
    adapter.get('/api/openapi.json', async () => document);
  }
  await app.init();
  await adapter.getInstance().ready();
  return { app, document };
}
