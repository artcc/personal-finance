import type { CommitmentDefinition, CommitmentProjection } from '../domain/commitment.js';
import type { ListInput, SourceListInput } from '../../../shared/application/financial-input.js';

export const COMMITMENTS_STORE = Symbol('COMMITMENTS_STORE');
export interface CommitmentRevisionRecord {
  id: string;
  version: number;
  input: CommitmentDefinition;
  createdAt: string;
}
export interface CommitmentRecord {
  id: string;
  version: number;
  archivedFromMonth: string | null;
  revision: CommitmentRevisionRecord;
  projection: CommitmentProjection;
}
export interface CommitmentDetail {
  current: CommitmentRecord;
  history: CommitmentRevisionRecord[];
  page: number;
  pageSize: number;
  total: number;
  month: string;
}
export interface CommitmentsStore {
  list(
    userId: string,
    input: SourceListInput,
    month: string,
  ): Promise<{ items: CommitmentRecord[]; total: number }>;
  detail(userId: string, id: string, input: ListInput, month: string): Promise<CommitmentDetail>;
  create(userId: string, input: CommitmentDefinition, month: string): Promise<CommitmentRecord>;
  revise(
    userId: string,
    id: string,
    input: CommitmentDefinition,
    expectedVersion: number,
    month: string,
  ): Promise<CommitmentRecord>;
  archive(userId: string, id: string, month: string, expectedVersion: number): Promise<void>;
}
