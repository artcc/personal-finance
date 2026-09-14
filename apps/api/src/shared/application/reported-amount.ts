import type { Money } from '../domain/money.js';
export interface DatedAmount {
  id: string;
  asOf: string;
  amount: Money;
}
