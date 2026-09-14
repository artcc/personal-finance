import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { HealthController } from './modules/system/health.controller.js';
import { HealthService } from './modules/system/health.service.js';
import { InfrastructureModule } from './shared/infrastructure.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { IncomeModule } from './modules/income/income.module.js';
import { CommitmentsModule } from './modules/commitments/commitments.module.js';
import { PlanningModule } from './modules/planning/planning.module.js';
import { FinancialContextController } from './shared/http/financial-context.controller.js';
import type { Environment } from './shared/environment.js';

@Module({})
export class AppModule {
  static register(environment: Environment): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InfrastructureModule.register(environment),
        IdentityModule,
        AccountsModule,
        IncomeModule,
        CommitmentsModule,
        PlanningModule,
      ],
      controllers: [HealthController, FinancialContextController],
      providers: [HealthService],
    };
  }
}
