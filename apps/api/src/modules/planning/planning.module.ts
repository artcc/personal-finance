import { Module } from '@nestjs/common';
import { PlanningController } from './http/planning.controller.js';
import { PlanningService } from './application/planning.service.js';
import { PLANNING_STORE } from './application/planning.port.js';
import { PrismaPlanningStore } from './infrastructure/prisma-planning.store.js';

@Module({
  controllers: [PlanningController],
  providers: [PlanningService, { provide: PLANNING_STORE, useClass: PrismaPlanningStore }],
})
export class PlanningModule {}
