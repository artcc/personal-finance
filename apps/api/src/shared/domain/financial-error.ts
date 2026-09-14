export type FinancialErrorCode =
  | 'INVALID_FINANCIAL_INPUT'
  | 'INVALID_AMOUNT'
  | 'INVALID_DECIMAL'
  | 'INVALID_EFFECTIVE_PERIOD'
  | 'INVALID_DUE_SCHEDULE'
  | 'INSTALLMENT_TOTAL_MISMATCH'
  | 'INVALID_RECEIPT_AMOUNT'
  | 'ACCOUNT_NOT_FOUND'
  | 'SPACE_NOT_FOUND'
  | 'INCOME_SOURCE_NOT_FOUND'
  | 'COMMITMENT_NOT_FOUND'
  | 'DESTINATION_NOT_FOUND'
  | 'DESTINATION_UNAVAILABLE'
  | 'DESTINATION_IN_USE'
  | 'VERSION_CONFLICT'
  | 'ARCHIVE_PREVIEW_CONFLICT'
  | 'RESOURCE_ARCHIVED';

export class FinancialError extends Error {
  constructor(readonly code: FinancialErrorCode) {
    super(code);
    this.name = 'FinancialError';
  }
}
