import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { HealthController } from './modules/system/health.controller.js';
import { HealthService } from './modules/system/health.service.js';
import { InfrastructureModule } from './shared/infrastructure.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import type { Environment } from './shared/environment.js';

@Module({})
export class AppModule {
  static register(environment: Environment): DynamicModule {
    return {
      module: AppModule,
      imports: [InfrastructureModule.register(environment), IdentityModule],
      controllers: [HealthController],
      providers: [HealthService],
    };
  }
}
