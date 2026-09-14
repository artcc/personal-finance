import type { IncomeCalculation, IncomeDefinition } from '../domain/income.js';
import type { ListInput, SourceListInput } from '../../../shared/application/financial-input.js';

export const INCOME_STORE = Symbol('INCOME_STORE');
export interface IncomeRevisionRecord {
  id: string;
  version: number;
  input: IncomeDefinition;
  calculation: IncomeCalculation;
  createdAt: string;
}
export interface IncomeRecord {
  id: string;
  version: number;
  archivedFromMonth: string | null;
  recurrence: 'monthly' | 'once';
  oneOffMonth: string | null;
  revision: IncomeRevisionRecord;
  active: boolean;
  calculation: IncomeCalculation;
}
export interface IncomeDetail {
  current: IncomeRecord;
  history: IncomeRevisionRecord[];
  page: number;
  pageSize: number;
  total: number;
  month: string;
}
export interface IncomeStore {
  list(
    userId: string,
    input: SourceListInput,
    month: string,
    recurrence: 'monthly' | 'once',
  ): Promise<{ items: IncomeRecord[]; total: number }>;
  detail(userId: string, id: string, input: ListInput, month: string): Promise<IncomeDetail>;
  create(
    userId: string,
    input: IncomeDefinition,
    calculation: IncomeCalculation,
    recurrence: 'monthly' | 'once',
    month: string,
  ): Promise<IncomeRecord>;
  revise(
    userId: string,
    id: string,
    input: IncomeDefinition,
    calculation: IncomeCalculation,
    expectedVersion: number,
    month: string,
    recurrence: 'monthly' | 'once',
  ): Promise<IncomeRecord>;
  archive(userId: string, id: string, month: string, expectedVersion: number): Promise<void>;
}
