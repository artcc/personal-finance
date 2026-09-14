import { Inject, Injectable } from '@nestjs/common';
import { COMMITMENTS_STORE } from './commitments.port.js';
import type { CommitmentsStore } from './commitments.port.js';
import { projectCommitment, validateCommitment } from '../domain/commitment.js';
import type { CommitmentDefinition } from '../domain/commitment.js';
import { FinancialClock } from '../../../shared/application/financial-clock.js';
import type { ListInput, SourceListInput } from '../../../shared/application/financial-input.js';
import { validMonth } from '../../../shared/domain/calendar.js';

@Injectable()
export class CommitmentsService {
  constructor(
    @Inject(COMMITMENTS_STORE) private readonly store: CommitmentsStore,
    @Inject(FinancialClock) private readonly clock: FinancialClock,
  ) {}
  async list(userId: string, input: SourceListInput) {
    const month = validMonth(input.month ?? this.clock.context().month);
    return {
      ...(await this.store.list(userId, input, month)),
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
  preview(input: CommitmentDefinition, month: string) {
    return projectCommitment(input, validMonth(month));
  }
  create(userId: string, input: CommitmentDefinition) {
    validateCommitment(input);
    return this.store.create(userId, input, this.clock.context().month);
  }
  revise(userId: string, id: string, input: CommitmentDefinition, version: number) {
    validateCommitment(input);
    return this.store.revise(userId, id, input, version, this.clock.context().month);
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
