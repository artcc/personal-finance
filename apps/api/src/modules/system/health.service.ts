import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../shared/database.service.js';
import type { ReadinessDto } from './health.dto.js';

@Injectable()
export class HealthService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async readiness(): Promise<ReadinessDto> {
    try {
      await this.database.ping();
      return { status: 'ok', database: 'available' };
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE' });
    }
  }
}
