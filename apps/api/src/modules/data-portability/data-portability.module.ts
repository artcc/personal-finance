import { Module } from '@nestjs/common';
import { DATA_STORE } from './application/data.port.js';
import { DataService } from './application/data.service.js';
import { PrismaDataStore } from './infrastructure/prisma-data.store.js';
import { DataController } from './http/data.controller.js';
@Module({
  controllers: [DataController],
  providers: [DataService, { provide: DATA_STORE, useClass: PrismaDataStore }],
})
export class DataPortabilityModule {}
