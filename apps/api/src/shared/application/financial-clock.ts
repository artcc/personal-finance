import { Inject, Injectable } from '@nestjs/common';
import { ENVIRONMENT } from '../environment.js';
import type { Environment } from '../environment.js';

@Injectable()
export class FinancialClock {
  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}
  context(): { month: string; today: string; currency: 'EUR' } {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: this.environment.PLANNING_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    const month = `${part('year')}-${part('month')}`;
    return { month, today: `${month}-${part('day')}`, currency: 'EUR' };
  }
}
