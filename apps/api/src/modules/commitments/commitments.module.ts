import { Module } from '@nestjs/common';
import { CommitmentsController } from './http/commitments.controller.js';
import { CommitmentsService } from './application/commitments.service.js';
import { COMMITMENTS_STORE } from './application/commitments.port.js';
import { PrismaCommitmentsStore } from './infrastructure/prisma-commitments.store.js';
@Module({
  controllers: [CommitmentsController],
  providers: [CommitmentsService, { provide: COMMITMENTS_STORE, useClass: PrismaCommitmentsStore }],
})
export class CommitmentsModule {}
