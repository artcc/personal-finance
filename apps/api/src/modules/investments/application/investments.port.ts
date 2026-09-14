import type { Money } from '../../../shared/domain/money.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import type { LinkedPlan, PlanningLinkInput } from '../../../shared/application/planning-link.js';
import type {
  InvestmentMode,
  Movement,
  MovementInput,
  MovementSummary,
} from '../domain/movements.js';
import type { DatedAmount } from '../../../shared/application/reported-amount.js';

export const INVESTMENTS_STORE = Symbol('INVESTMENTS_STORE');
export interface InvestmentMetadata {
  name: string;
  platform: string | null;
  ticker: string | null;
  kind: 'fund' | 'pension' | 'crypto' | 'other';
}
export interface InvestmentRecord extends InvestmentMetadata {
  id: string;
  version: number;
  mode: InvestmentMode;
  planning: LinkedPlan | null;
  summary: MovementSummary;
  latestValuation: DatedAmount | null;
  valuationStale: boolean;
}
export interface InvestmentsStore {
  list(
    userId: string,
    query: ListInput,
    month: string,
  ): Promise<{ items: InvestmentRecord[]; total: number }>;
  detail(userId: string, id: string, month: string): Promise<InvestmentRecord>;
  create(
    userId: string,
    input: InvestmentMetadata & { mode: InvestmentMode; planning: PlanningLinkInput | null },
    month: string,
  ): Promise<InvestmentRecord>;
  update(
    userId: string,
    id: string,
    input: InvestmentMetadata & { planning: PlanningLinkInput | null },
    expectedVersion: number,
    month: string,
  ): Promise<InvestmentRecord>;
  entries(
    userId: string,
    id: string,
    query: ListInput,
  ): Promise<{ items: Movement[]; total: number }>;
  writeEntry(
    userId: string,
    id: string,
    expectedVersion: number,
    input: MovementInput,
    previousId: string | null,
    reason: string | null,
    today: string,
    month: string,
  ): Promise<InvestmentRecord>;
  voidEntry(
    userId: string,
    id: string,
    entryId: string,
    expectedVersion: number,
    reason: string,
    month: string,
  ): Promise<InvestmentRecord>;
  value(
    userId: string,
    id: string,
    expectedVersion: number,
    input: { asOf: string; amount: Money },
    month: string,
  ): Promise<InvestmentRecord>;
  valuations(
    userId: string,
    id: string,
    query: ListInput,
  ): Promise<{ items: DatedAmount[]; total: number }>;
}
