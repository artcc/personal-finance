import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Environment } from './shared/environment.js';
import { HttpErrorFilter } from './shared/http-error.filter.js';

export async function createApplication(environment: Environment) {
  const adapter = new FastifyAdapter({
    logger: environment.NODE_ENV !== 'test',
    genReqId: () => randomUUID(),
    requestIdHeader: false,
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
