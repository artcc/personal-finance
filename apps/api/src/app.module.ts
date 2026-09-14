import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { HealthController } from './modules/system/health.controller.js';
import { HealthService } from './modules/system/health.service.js';
import { DatabaseService } from './shared/database.service.js';
import { ENVIRONMENT } from './shared/environment.js';
import type { Environment } from './shared/environment.js';

@Module({})
export class AppModule {
  static register(environment: Environment): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [{ provide: ENVIRONMENT, useValue: environment }, DatabaseService, HealthService],
    };
  }
}
