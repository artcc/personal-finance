import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { ENVIRONMENT } from './environment.js';
import type { Environment } from './environment.js';

@Global()
@Module({})
export class InfrastructureModule {
  static register(environment: Environment): DynamicModule {
    return {
      module: InfrastructureModule,
      providers: [{ provide: ENVIRONMENT, useValue: environment }, DatabaseService],
      exports: [ENVIRONMENT, DatabaseService],
    };
  }
}
