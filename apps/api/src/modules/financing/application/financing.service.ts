import { Inject, Injectable } from '@nestjs/common';
import { FINANCING_STORE } from './financing.port.js';
import type { FinancingStore, FinancingMetadata } from './financing.port.js';
import type { PlanningLinkInput } from '../../../shared/application/planning-link.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import type { Money } from '../../../shared/domain/money.js';
import { cents } from '../../../shared/domain/money.js';
import { reportedDate, validMonth } from '../../../shared/domain/calendar.js';
import { FinancialClock } from '../../../shared/application/financial-clock.js';

@Injectable()
export class FinancingService {
  constructor(
    @Inject(FINANCING_STORE) private readonly store: FinancingStore,
    @Inject(FinancialClock) private readonly clock: FinancialClock,
  ) {}
  detail(userId: string, id: string) {
    return this.store.detail(userId, id, this.clock.context().month);
  }
  async list(userId: string, query: ListInput) {
    const month = validMonth(query.month ?? this.clock.context().month);
    return {
      ...(await this.store.list(userId, query, month)),
      page: query.page,
      pageSize: query.pageSize,
      month,
    };
  }
  create(userId: string, input: FinancingMetadata & { planning: PlanningLinkInput }) {
    if (input.originalPrincipal) cents(input.originalPrincipal);
    return this.store.create(userId, input, this.clock.context().month);
  }
  update(userId: string, id: string, input: FinancingMetadata, expectedVersion: number) {
    if (input.originalPrincipal) cents(input.originalPrincipal);
    return this.store.update(userId, id, input, expectedVersion, this.clock.context().month);
  }
  report(
    userId: string,
    id: string,
    input: { asOf: string; amount: Money; expectedVersion: number },
  ) {
    reportedDate(input.asOf, this.clock.context().today);
    cents(input.amount);
    return this.store.report(userId, id, input, this.clock.context().month);
  }
  async reports(userId: string, id: string, query: ListInput) {
    return {
      ...(await this.store.reports(userId, id, query)),
      page: query.page,
      pageSize: query.pageSize,
      month: this.clock.context().month,
    };
  }
}
