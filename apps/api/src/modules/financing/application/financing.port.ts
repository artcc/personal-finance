import type { Money } from '../../../shared/domain/money.js';
import type { LinkedPlan, PlanningLinkInput } from '../../../shared/application/planning-link.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import type { DatedAmount } from '../../../shared/application/reported-amount.js';

export const FINANCING_STORE = Symbol('FINANCING_STORE');
export interface FinancingMetadata {
  name: string;
  lender: string | null;
  originalPrincipal: Money | null;
}
export interface FinancingRecord extends FinancingMetadata {
  id: string;
  version: number;
  planning: LinkedPlan;
  latestDebt: DatedAmount | null;
}
export interface FinancingStore {
  detail(userId: string, id: string, month: string): Promise<FinancingRecord>;
  list(
    userId: string,
    query: ListInput,
    month: string,
  ): Promise<{ items: FinancingRecord[]; total: number }>;
  create(
    userId: string,
    input: FinancingMetadata & { planning: PlanningLinkInput },
    month: string,
  ): Promise<FinancingRecord>;
  update(
    userId: string,
    id: string,
    input: FinancingMetadata,
    expectedVersion: number,
    month: string,
  ): Promise<FinancingRecord>;
  report(
    userId: string,
    id: string,
    input: { asOf: string; amount: Money; expectedVersion: number },
    month: string,
  ): Promise<FinancingRecord>;
  reports(
    userId: string,
    id: string,
    query: ListInput,
  ): Promise<{ items: DatedAmount[]; total: number }>;
}
