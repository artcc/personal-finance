import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ENVIRONMENT } from './environment.js';
import type { Environment } from './environment.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    const adapter = new PrismaPg({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: 3_000,
      query_timeout: 3_000,
      max: 5,
    });
    this.client = new PrismaClient({ adapter });
  }

  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
