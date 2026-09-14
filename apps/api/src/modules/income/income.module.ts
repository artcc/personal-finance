import { Module } from '@nestjs/common';
import { IncomeController } from './http/income.controller.js';
import { IncomeService } from './application/income.service.js';
import { INCOME_STORE } from './application/income.port.js';
import { PrismaIncomeStore } from './infrastructure/prisma-income.store.js';
@Module({
  controllers: [IncomeController],
  providers: [IncomeService, { provide: INCOME_STORE, useClass: PrismaIncomeStore }],
})
export class IncomeModule {}
