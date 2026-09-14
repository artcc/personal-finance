import { Module } from '@nestjs/common';
import { FinancingService } from './application/financing.service.js';
import { FINANCING_STORE } from './application/financing.port.js';
import { PrismaFinancingStore } from './infrastructure/prisma-financing.store.js';
import { FinancingController } from './http/financing.controller.js';
@Module({
  controllers: [FinancingController],
  providers: [FinancingService, { provide: FINANCING_STORE, useClass: PrismaFinancingStore }],
})
export class FinancingModule {}
