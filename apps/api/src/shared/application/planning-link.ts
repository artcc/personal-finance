import type { CommitmentDefinition } from '../../modules/commitments/domain/commitment.js';
import type { Money } from '../domain/money.js';
export interface PlanningLinkInput {
  sourceId: string | null;
  expectedVersion: number | null;
  definition: CommitmentDefinition | null;
}
export interface LinkedPlan {
  id: string;
  version: number;
  definition: CommitmentDefinition;
  archivedFromMonth: string | null;
  active: boolean;
  monthlyCharge: Money;
}
