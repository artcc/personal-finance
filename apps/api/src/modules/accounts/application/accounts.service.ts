import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTS_STORE } from './accounts.port.js';
import type { AccountInput, AccountsStore } from './accounts.port.js';
import { validMonth } from '../../../shared/domain/calendar.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';
import { FinancialClock } from '../../../shared/application/financial-clock.js';
import type { ListInput } from '../../../shared/application/financial-input.js';

function name(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) throw new FinancialError('INVALID_FINANCIAL_INPUT');
  return trimmed;
}
@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNTS_STORE) private readonly store: AccountsStore,
    @Inject(FinancialClock) private readonly clock: FinancialClock,
  ) {}
  async list(userId: string, input: ListInput) {
    const month = validMonth(input.month ?? this.clock.context().month);
    return {
      ...(await this.store.list(userId, input, month)),
      page: input.page,
      pageSize: input.pageSize,
      month,
    };
  }
  async spaces(userId: string, id: string, input: ListInput) {
    const month = validMonth(input.month ?? this.clock.context().month);
    return {
      ...(await this.store.spaces(userId, id, input, month)),
      page: input.page,
      pageSize: input.pageSize,
      month,
    };
  }
  create(userId: string, input: AccountInput) {
    return this.store.create(userId, {
      ...input,
      name: name(input.name),
      institution: input.institution || null,
      reference: input.reference || null,
    });
  }
  update(userId: string, id: string, input: AccountInput, expectedVersion: number) {
    return this.store.update(
      userId,
      id,
      {
        ...input,
        name: name(input.name),
        institution: input.institution || null,
        reference: input.reference || null,
      },
      expectedVersion,
    );
  }
  createSpace(userId: string, id: string, value: string) {
    return this.store.createSpace(userId, id, name(value));
  }
  updateSpace(userId: string, id: string, value: string, expectedVersion: number) {
    return this.store.updateSpace(userId, id, name(value), expectedVersion);
  }
  preview(userId: string, id: string, month: string, space: boolean) {
    return this.store.previewArchive(userId, id, validMonth(month), space);
  }
  archive(
    userId: string,
    id: string,
    input: { archivedFromMonth: string; expectedVersion: number; spaceIds: string[] },
    space: boolean,
  ) {
    return this.store.archive(
      userId,
      id,
      validMonth(input.archivedFromMonth),
      input.expectedVersion,
      input.spaceIds,
      space,
    );
  }
}
