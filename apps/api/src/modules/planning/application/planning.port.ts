import type {
  PlanInputs,
  PlanSnapshot,
  PlanSummary,
  PlanValues,
  PlanDestination,
} from '../domain/plan.js';

export const PLANNING_STORE = Symbol('PLANNING_STORE');
export interface StoredPlan {
  id: string;
  month: string;
  revision: number;
  currentRevision: number;
  version: number;
  state: 'draft' | 'closed';
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  reopenReason: string | null;
  snapshot: PlanSnapshot;
  summary: PlanSummary;
}
export interface PlanView extends PlanValues {
  id: string;
  month: string;
  revision: number;
  currentRevision: number;
  version: number;
  state: 'draft' | 'closed';
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  reopenReason: string | null;
}
export interface PlanningWork {
  byMonth(month: string): Promise<StoredPlan | null>;
  byId(id: string, revision?: number): Promise<StoredPlan | null>;
  inputs(month: string): Promise<PlanInputs>;
  destinations(month: string): Promise<PlanDestination[]>;
  create(snapshot: PlanSnapshot, summary: PlanSummary): Promise<StoredPlan>;
  save(
    previous: StoredPlan,
    snapshot: PlanSnapshot,
    summary: PlanSummary,
    state: 'draft' | 'closed',
    reopenReason?: string,
  ): Promise<StoredPlan>;
  event(plan: StoredPlan, action: string, payload: object): Promise<void>;
}
export interface PlanHistoryItem {
  revision: number;
  version: number;
  state: 'draft' | 'closed';
  createdAt: string;
  closedAt: string | null;
  reopenReason: string | null;
  availability: PlanSummary['plannedAvailability'];
}
export interface PlanTrendItem {
  month: string;
  state: 'draft' | 'closed';
  availability: PlanSummary['plannedAvailability'];
}
export interface PlanningStore {
  transaction<T>(userId: string, operation: (work: PlanningWork) => Promise<T>): Promise<T>;
  history(
    userId: string,
    planId: string,
    page: number,
  ): Promise<{ items: PlanHistoryItem[]; total: number }>;
  trend(userId: string, fromMonth: string, throughMonth: string): Promise<PlanTrendItem[]>;
}
