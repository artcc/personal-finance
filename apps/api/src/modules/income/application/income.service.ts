import { Inject, Injectable } from '@nestjs/common';
import { INCOME_STORE } from './income.port.js';
import type { IncomeStore } from './income.port.js';
import { calculateIncome } from '../domain/income.js';
import type { IncomeDefinition } from '../domain/income.js';
import { FinancialClock } from '../../../shared/application/financial-clock.js';
import type { ListInput, SourceListInput } from '../../../shared/application/financial-input.js';
import { activeInMonth, validMonth } from '../../../shared/domain/calendar.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';

@Injectable()
export class IncomeService {
  constructor(
    @Inject(INCOME_STORE) private readonly store: IncomeStore,
    @Inject(FinancialClock) private readonly clock: FinancialClock,
  ) {}
  async list(userId: string, input: SourceListInput, recurrence: 'monthly' | 'once') {
    const month = validMonth(input.month ?? this.clock.context().month);
    return {
      ...(await this.store.list(userId, input, month, recurrence)),
      page: input.page,
      pageSize: input.pageSize,
      month,
    };
  }
  detail(userId: string, id: string, input: ListInput) {
    return this.store.detail(
      userId,
      id,
      input,
      validMonth(input.month ?? this.clock.context().month),
    );
  }
  preview(input: IncomeDefinition) {
    return calculateIncome(input);
  }
  create(userId: string, input: IncomeDefinition, recurrence: 'monthly' | 'once') {
    const calculation = calculateIncome(input);
    if (recurrence === 'once' && !activeInMonth(input, input.effectiveFromMonth))
      throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
    return this.store.create(userId, input, calculation, recurrence, this.clock.context().month);
  }
  revise(
    userId: string,
    id: string,
    input: IncomeDefinition,
    version: number,
    recurrence: 'monthly' | 'once',
  ) {
    const calculation = calculateIncome(input);
    if (recurrence === 'once' && !activeInMonth(input, input.effectiveFromMonth))
      throw new FinancialError('INVALID_EFFECTIVE_PERIOD');
    return this.store.revise(
      userId,
      id,
      input,
      calculation,
      version,
      this.clock.context().month,
      recurrence,
    );
  }
  archive(
    userId: string,
    id: string,
    input: { archivedFromMonth: string; expectedVersion: number },
  ) {
    return this.store.archive(
      userId,
      id,
      validMonth(input.archivedFromMonth),
      input.expectedVersion,
    );
  }
}
