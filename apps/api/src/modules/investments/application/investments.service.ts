import { Inject, Injectable } from '@nestjs/common';
import { INVESTMENTS_STORE } from './investments.port.js';
import type { InvestmentsStore, InvestmentMetadata } from './investments.port.js';
import type { InvestmentMode, MovementInput } from '../domain/movements.js';
import type { PlanningLinkInput } from '../../../shared/application/planning-link.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import type { Money } from '../../../shared/domain/money.js';
import { cents } from '../../../shared/domain/money.js';
import { reportedDate, validMonth } from '../../../shared/domain/calendar.js';
import { FinancialClock } from '../../../shared/application/financial-clock.js';

@Injectable()
export class InvestmentsService {
  constructor(
    @Inject(INVESTMENTS_STORE) private readonly store: InvestmentsStore,
    @Inject(FinancialClock) private readonly clock: FinancialClock,
  ) {}
  async list(userId: string, query: ListInput) {
    const month = validMonth(query.month ?? this.clock.context().month);
    return {
      ...(await this.store.list(userId, query, month)),
      page: query.page,
      pageSize: query.pageSize,
      month,
    };
  }
  detail(userId: string, id: string) {
    return this.store.detail(userId, id, this.clock.context().month);
  }
  create(
    userId: string,
    input: InvestmentMetadata & { mode: InvestmentMode; planning: PlanningLinkInput | null },
  ) {
    return this.store.create(userId, input, this.clock.context().month);
  }
  update(
    userId: string,
    id: string,
    input: InvestmentMetadata & { planning: PlanningLinkInput | null },
    expectedVersion: number,
  ) {
    return this.store.update(userId, id, input, expectedVersion, this.clock.context().month);
  }
  async entries(userId: string, id: string, query: ListInput) {
    return {
      ...(await this.store.entries(userId, id, query)),
      page: query.page,
      pageSize: query.pageSize,
      month: this.clock.context().month,
    };
  }
  writeEntry(
    userId: string,
    id: string,
    version: number,
    input: MovementInput,
    previousId: string | null = null,
    reason: string | null = null,
  ) {
    const context = this.clock.context();
    return this.store.writeEntry(
      userId,
      id,
      version,
      input,
      previousId,
      reason,
      context.today,
      context.month,
    );
  }
  voidEntry(userId: string, id: string, entryId: string, version: number, reason: string) {
    return this.store.voidEntry(userId, id, entryId, version, reason, this.clock.context().month);
  }
  value(userId: string, id: string, version: number, input: { asOf: string; amount: Money }) {
    reportedDate(input.asOf, this.clock.context().today);
    cents(input.amount);
    return this.store.value(userId, id, version, input, this.clock.context().month);
  }
  async valuations(userId: string, id: string, query: ListInput) {
    return {
      ...(await this.store.valuations(userId, id, query)),
      page: query.page,
      pageSize: query.pageSize,
      month: this.clock.context().month,
    };
  }
}
