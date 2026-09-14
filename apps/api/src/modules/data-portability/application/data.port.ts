import type { FinancialDocument } from './document.js';
export const DATA_STORE = Symbol('DATA_STORE');
export interface DataStore {
  export(userId: string): Promise<FinancialDocument>;
  isEmpty(userId: string): Promise<boolean>;
  import(userId: string, document: FinancialDocument, fingerprint: string): Promise<void>;
}
