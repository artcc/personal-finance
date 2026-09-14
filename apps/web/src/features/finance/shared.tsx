import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../lib/api-error';

export function FinanceError({ error }: { error: unknown }) {
  const { t } = useTranslation('finance');
  const codes: Record<string, string> = {
    VERSION_CONFLICT: 'conflict',
    ARCHIVE_PREVIEW_CONFLICT: 'conflict',
    DESTINATION_IN_USE: 'destinationInUse',
    DESTINATION_UNAVAILABLE: 'destinationUnavailable',
    ACCOUNT_NOT_FOUND: 'notFound',
    SPACE_NOT_FOUND: 'notFound',
    INCOME_SOURCE_NOT_FOUND: 'notFound',
    COMMITMENT_NOT_FOUND: 'notFound',
    DESTINATION_NOT_FOUND: 'notFound',
    RESOURCE_ARCHIVED: 'archived',
    INVALID_AMOUNT: 'invalidMoney',
    INVALID_DECIMAL: 'invalidDecimal',
    INVALID_EFFECTIVE_PERIOD: 'invalidPeriod',
    INVALID_DUE_SCHEDULE: 'invalidSchedule',
    INSTALLMENT_TOTAL_MISMATCH: 'installmentTotal',
    INVALID_RECEIPT_AMOUNT: 'invalidReceipt',
    INVALID_FINANCIAL_INPUT: 'invalidInput',
  };
  return (
    <p role="alert" className="feedback-banner feedback-banner--error">
      {t(
        `errors.${error instanceof ApiError ? (codes[error.code] ?? 'unexpected') : 'unexpected'}`,
      )}
    </p>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation('finance');
  const known = [
    'required',
    'invalidMoney',
    'invalidDecimal',
    'invalidMonth',
    'invalidDate',
    'invalidDay',
    'invalidInput',
    'accountRequired',
  ];
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {t(`validation.${known.includes(error) ? error : 'invalidInput'}`)}
        </p>
      )}
    </div>
  );
}

export function ResourceDialog({
  title,
  onClose,
  busy = false,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('finance');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className={`resource-dialog${wide ? ' resource-dialog--wide' : ''}`}
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="resource-dialog-heading">
        <h2>{title}</h2>
        <Button variant="outline" disabled={busy} onClick={onClose} aria-label={t('close')}>
          ×
        </Button>
      </header>
      {children}
    </dialog>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation('finance');
  return (
    <nav className="pagination" aria-label={t('pagination')}>
      <span>{t('pageInfo', { page, pages: Math.max(1, Math.ceil(total / pageSize)), total })}</span>
      <div>
        <Button variant="outline" disabled={page === 1} onClick={() => onChange(page - 1)}>
          {t('previous')}
        </Button>
        <Button
          variant="outline"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          {t('next')}
        </Button>
      </div>
    </nav>
  );
}
