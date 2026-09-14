import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ApiError, requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { LoadingState, ConnectionError } from '../../components/ui/feedback';
import { Field, FinanceError, Pagination, ResourceDialog } from '../finance/shared';
import { useFinancialContext } from '../finance/use-financial-context';
import {
  decimalInput,
  formatMoney,
  moneyInput,
  parseDecimalInput,
  parseMoneyInput,
} from '../finance/presentation';
import type { Session } from '../auth/session';
import type { Investment, Movement, AssetKind } from './asset-api';
import { refreshAssets, formatReportedDate } from './asset-api';
import { ReportDialog } from './record-dialogs';

export function InvestmentMovementsPage() {
  const { t, i18n } = useTranslation(['assets', 'finance']);
  const session = useOutletContext<Session>();
  const { id = '' } = useParams<{ id: string }>();
  const context = useFinancialContext(session.user.id);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ entry: Movement | null } | null>(null);
  const [voiding, setVoiding] = useState<Movement | null>(null);
  const [report, setReport] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const investment = useQuery({
    queryKey: ['investment-detail', session.user.id, id],
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/api/v1/investments/{id}', { signal, params: { path: { id } } })),
  });
  const entries = useQuery({
    queryKey: ['investment-entries', session.user.id, id, page],
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/investments/{id}/entries', {
          signal,
          params: { path: { id }, query: { page, pageSize: 20 } },
        }),
      ),
  });
  if (investment.isPending) return <LoadingState />;
  if (investment.isError) return <ConnectionError retry={() => void investment.refetch()} />;
  const record = investment.data;
  return (
    <>
      <header className="financial-page-heading">
        <div>
          <p className="eyebrow">{t('movements')}</p>
          <h1>{record.name}</h1>
          <p>{t('movementPageHint')}</p>
        </div>
        <div className="record-actions">
          <Button disabled={!context.data} onClick={() => setEditing({ entry: null })}>
            {t('addMovement')}
          </Button>
          <Button variant="outline" disabled={!context.data} onClick={() => setReport(true)}>
            {t('reportValuation')}
          </Button>
        </div>
      </header>
      <Link to="/investments" className="back-link">
        {t('backInvestments')}
      </Link>
      <div className="asset-summary-strip">
        <span>
          {t('recordedIn')}
          <strong>{formatMoney(record.summary.moneyIn, i18n.resolvedLanguage)}</strong>
        </span>
        <span>
          {t('recordedOut')}
          <strong>{formatMoney(record.summary.moneyOut, i18n.resolvedLanguage)}</strong>
        </span>
        <span>
          {t('netCashFlow')}
          <strong>{formatMoney(record.summary.netCashFlow, i18n.resolvedLanguage)}</strong>
        </span>
        {record.summary.units !== null && (
          <span>
            {t('units')}
            <strong>{decimalInput(record.summary.units)}</strong>
          </span>
        )}
      </div>
      {record.summary.openingCapitalUnknown && (
        <p className="record-status">{t('partialCapital')}</p>
      )}
      <p className="field-hint">{t('cashFlowHint')}</p>
      {entries.isPending ? (
        <LoadingState />
      ) : entries.isError ? (
        <ConnectionError retry={() => void entries.refetch()} />
      ) : (
        <section className="planning-panel">
          <h2>{t('movements')}</h2>
          {entries.data.items.length === 0 && <p className="form-intro">{t('noMovements')}</p>}
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('movementKind')}</th>
                  {record.mode === 'units' && <th>{t('units')}</th>}
                  <th>{t('amount')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label={t('date')}>
                      {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(`${entry.date}T00:00:00Z`))}
                    </td>
                    <td data-label={t('movementKind')}>
                      {t(`movementKinds.${entry.kind}`)}
                      {entry.note && <small>{entry.note}</small>}
                    </td>
                    {record.mode === 'units' && (
                      <td data-label={t('units')}>
                        {entry.quantity === null ? t('unknown') : decimalInput(entry.quantity)}
                      </td>
                    )}
                    <td data-label={t('amount')}>
                      {entry.amount === null
                        ? t('unknown')
                        : formatMoney(entry.amount, i18n.resolvedLanguage)}
                    </td>
                    <td data-label={t('status')}>
                      {t(entry.voidedAt ? 'voided' : entry.replacesId ? 'corrected' : 'recorded')}
                      {entry.voidReason && <small>{entry.voidReason}</small>}
                    </td>
                    <td data-label={t('actions')}>
                      <div className="record-actions">
                        <Button
                          variant="outline"
                          disabled={entry.voidedAt !== null || !context.data}
                          onClick={() => setEditing({ entry })}
                        >
                          {t('correct')}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={entry.voidedAt !== null}
                          onClick={() => setVoiding(entry)}
                        >
                          {t('void')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={entries.data.pageSize}
            total={entries.data.total}
            onChange={setPage}
          />
        </section>
      )}
      <details
        className="revision-history"
        onToggle={(event) => setShowReports(event.currentTarget.open)}
      >
        <summary>{t('valuationHistory')}</summary>
        {showReports && <AmountReports kind="investments" id={id} userId={session.user.id} />}
      </details>
      {editing && context.data && (
        <MovementEditor
          record={record}
          existing={editing.entry}
          userId={session.user.id}
          today={context.data.today}
          onClose={() => setEditing(null)}
        />
      )}
      {voiding && (
        <VoidMovement
          record={record}
          entry={voiding}
          userId={session.user.id}
          onClose={() => setVoiding(null)}
        />
      )}
      {report && context.data && (
        <ReportDialog
          kind="investments"
          record={record}
          userId={session.user.id}
          today={context.data.today}
          onClose={() => setReport(false)}
        />
      )}
    </>
  );
}

function MovementEditor({
  record,
  existing,
  userId,
  today,
  onClose,
}: {
  record: Investment;
  existing: Movement | null;
  userId: string;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['assets', 'finance']);
  const units = record.mode === 'units';
  const [expectedVersion] = useState(record.version);
  const schema = z
    .object({
      date: z.iso.date({ error: 'invalidDate' }),
      kind: z.enum(['opening', 'contribution', 'withdrawal', 'buy', 'sell']),
      quantity: z.string(),
      amount: z.string(),
      note: z.string().max(500, 'invalidInput'),
      reason: z.string().max(500, 'invalidInput'),
      unknownCapital: z.boolean(),
    })
    .superRefine((value, context) => {
      if (value.date > today)
        context.addIssue({ code: 'custom', path: ['date'], message: 'invalidDate' });
      if (units)
        try {
          parseDecimalInput(value.quantity);
        } catch {
          context.addIssue({ code: 'custom', path: ['quantity'], message: 'invalidDecimal' });
        }
      if (!(units && value.kind === 'opening' && value.unknownCapital))
        try {
          parseMoneyInput(value.amount);
        } catch {
          context.addIssue({ code: 'custom', path: ['amount'], message: 'invalidMoney' });
        }
      if (existing && !value.reason.trim())
        context.addIssue({ code: 'custom', path: ['reason'], message: 'required' });
    });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: existing?.date ?? today,
      kind: existing?.kind ?? (units ? 'buy' : 'contribution'),
      quantity: decimalInput(existing?.quantity ?? null),
      amount: moneyInput(existing?.amount ?? null),
      note: existing?.note ?? '',
      reason: '',
      unknownCapital: existing?.kind === 'opening' && existing.amount === null,
    },
  });
  const watched = useWatch({ control: form.control });
  const save = useMutation({
    mutationFn: async (values: z.output<typeof schema>) => {
      const input = {
        date: values.date,
        kind: values.kind,
        quantity: units ? parseDecimalInput(values.quantity) : null,
        amount:
          units && values.kind === 'opening' && values.unknownCapital
            ? null
            : parseMoneyInput(values.amount),
        note: values.note.trim() || null,
      };
      return existing
        ? requireData(
            await api.POST('/api/v1/investments/{id}/entries/{entryId}/correct', {
              params: { path: { id: record.id, entryId: existing.id }, header: csrfHeaders() },
              body: { expectedVersion, input, reason: values.reason },
            }),
          )
        : requireData(
            await api.POST('/api/v1/investments/{id}/entries', {
              params: { path: { id: record.id }, header: csrfHeaders() },
              body: { expectedVersion, input },
            }),
          );
    },
    onSuccess: async () => {
      onClose();
      await refreshAssets(userId);
    },
  });
  const kinds = units
    ? (['buy', 'sell', 'opening'] as const)
    : (['contribution', 'withdrawal', 'opening'] as const);
  return (
    <ResourceDialog
      title={t(existing ? 'correctMovement' : 'addMovement')}
      busy={save.isPending}
      onClose={onClose}
    >
      <form noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <fieldset disabled={save.isPending}>
          <Field id="movement-date" label={t('date')} error={form.formState.errors.date?.message}>
            <Input id="movement-date" type="date" max={today} {...form.register('date')} />
          </Field>
          <fieldset disabled={existing?.kind === 'opening'}>
            <Field id="movement-kind" label={t('movementKind')}>
              <select id="movement-kind" className="form-input" {...form.register('kind')}>
                {kinds
                  .filter(
                    (value) => !existing || existing.kind === 'opening' || value !== 'opening',
                  )
                  .map((value) => (
                    <option key={value} value={value}>
                      {t(`movementKinds.${value}`)}
                    </option>
                  ))}
              </select>
            </Field>
          </fieldset>
          {units && (
            <Field
              id="movement-quantity"
              label={t('units')}
              error={form.formState.errors.quantity?.message}
            >
              <Input
                id="movement-quantity"
                inputMode="decimal"
                maxLength={32}
                {...form.register('quantity')}
              />
            </Field>
          )}
          {units && watched.kind === 'opening' && (
            <label className="checkbox-field">
              <input type="checkbox" {...form.register('unknownCapital')} />
              {t('unknownOpeningCapital')}
            </label>
          )}
          {!(units && watched.kind === 'opening' && watched.unknownCapital) && (
            <Field
              id="movement-amount"
              label={t('amount')}
              error={form.formState.errors.amount?.message}
              hint={t('movementAmountHint')}
            >
              <Input
                id="movement-amount"
                inputMode="decimal"
                maxLength={32}
                {...form.register('amount')}
              />
            </Field>
          )}
          <Field id="movement-note" label={t('note')}>
            <textarea
              id="movement-note"
              className="form-input"
              rows={2}
              maxLength={500}
              {...form.register('note')}
            />
          </Field>
          {existing && (
            <Field
              id="movement-reason"
              label={t('correctionReason')}
              error={form.formState.errors.reason?.message}
            >
              <textarea
                id="movement-reason"
                className="form-input"
                maxLength={500}
                required
                {...form.register('reason')}
              />
            </Field>
          )}
          {save.isError && <FinanceError error={save.error} />}
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button type="submit">{t('finance:save')}</Button>
          </div>
        </fieldset>
      </form>
    </ResourceDialog>
  );
}

function VoidMovement({
  record,
  entry,
  userId,
  onClose,
}: {
  record: Investment;
  entry: Movement;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['assets', 'finance']);
  const [expectedVersion] = useState(record.version);
  const schema = z.object({
    reason: z.string().trim().min(1, 'required').max(500, 'invalidInput'),
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  });
  const change = useMutation({
    mutationFn: async (values: z.output<typeof schema>) =>
      requireData(
        await api.POST('/api/v1/investments/{id}/entries/{entryId}/void', {
          params: { path: { id: record.id, entryId: entry.id }, header: csrfHeaders() },
          body: { expectedVersion, reason: values.reason },
        }),
      ),
    onSuccess: async () => {
      onClose();
      await refreshAssets(userId);
    },
  });
  return (
    <ResourceDialog title={t('voidMovement')} onClose={onClose} busy={change.isPending}>
      <p className="form-intro">{t('voidHint')}</p>
      <form noValidate onSubmit={form.handleSubmit((values) => change.mutate(values))}>
        <fieldset disabled={change.isPending}>
          <Field
            id="void-reason"
            label={t('correctionReason')}
            error={form.formState.errors.reason?.message}
          >
            <textarea
              id="void-reason"
              className="form-input"
              required
              maxLength={500}
              {...form.register('reason')}
            />
          </Field>
          {change.isError && <FinanceError error={change.error} />}
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button type="submit">{t('void')}</Button>
          </div>
        </fieldset>
      </form>
    </ResourceDialog>
  );
}

export function AmountReports({
  kind,
  id,
  userId,
}: {
  kind: AssetKind;
  id: string;
  userId: string;
}) {
  const { t, i18n } = useTranslation(['assets', 'finance']);
  const [page, setPage] = useState(1);
  const reports = useQuery({
    queryKey: ['asset-reports', userId, kind, id, page],
    queryFn: async ({ signal }) => {
      const options = { signal, params: { path: { id }, query: { page, pageSize: 20 } } };
      return kind === 'financing'
        ? requireData(await api.GET('/api/v1/financings/{id}/balances', options))
        : requireData(await api.GET('/api/v1/investments/{id}/valuations', options));
    },
  });
  return reports.isPending ? (
    <LoadingState />
  ) : reports.isError ? (
    <ConnectionError retry={() => void reports.refetch()} />
  ) : (
    <>
      <table className="asset-table">
        <thead>
          <tr>
            <th>{t('asOf')}</th>
            <th>{t('amount')}</th>
          </tr>
        </thead>
        <tbody>
          {reports.data.items.map((item) => (
            <tr key={item.id}>
              <td>{formatReportedDate(item.asOf, i18n.resolvedLanguage)}</td>
              <td>{formatMoney(item.amount, i18n.resolvedLanguage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.data.total === 0 && <p className="field-hint">{t('noReports')}</p>}
      <Pagination
        page={page}
        pageSize={reports.data.pageSize}
        total={reports.data.total}
        onChange={setPage}
      />
    </>
  );
}

export function FinancingReportsPage() {
  const { t } = useTranslation('assets');
  const { id = '' } = useParams<{ id: string }>();
  const session = useOutletContext<Session>();
  const financing = useQuery({
    queryKey: ['financing', session.user.id, id],
    queryFn: async ({ signal }) => {
      if (!id) throw new ApiError('FINANCING_NOT_FOUND');
      return requireData(
        await api.GET('/api/v1/financings/{id}', { signal, params: { path: { id } } }),
      );
    },
  });
  return (
    <>
      <header className="private-page-heading">
        <p className="eyebrow">{t('reports')}</p>
        <h1>{financing.data?.name ?? t('financingTitle')}</h1>
        <p>{t('debtHint')}</p>
      </header>
      <Link className="back-link" to="/financing">
        {t('backFinancing')}
      </Link>
      <section className="planning-panel">
        <AmountReports kind="financing" id={id} userId={session.user.id} />
      </section>
    </>
  );
}
