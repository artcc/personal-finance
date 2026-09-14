import { Module } from '@nestjs/common';
import { InvestmentsService } from './application/investments.service.js';
import { INVESTMENTS_STORE } from './application/investments.port.js';
import { PrismaInvestmentsStore } from './infrastructure/prisma-investments.store.js';
import { InvestmentsController } from './http/investments.controller.js';
@Module({
  controllers: [InvestmentsController],
  providers: [InvestmentsService, { provide: INVESTMENTS_STORE, useClass: PrismaInvestmentsStore }],
})
export class InvestmentsModule {}
