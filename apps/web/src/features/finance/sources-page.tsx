import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData, requireSuccess } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { queryClient } from '../../app/query-client';
import type { Session } from '../auth/session';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { Field, FinanceError, Pagination, ResourceDialog } from './shared';
import { useFinancialContext } from './use-financial-context';
import { SourceEditor } from './source-editor';
import type { CommitmentRecord, IncomeRecord, SourceKind } from './source-editor';
import { formatMoney } from './presentation';
import { z } from 'zod';

const filterKindSchema = z.enum([
  'all',
  'salary',
  'professional',
  'fixed',
  'subscription',
  'shared',
  'financing',
  'investment',
]);

export function SourcesPage({ kind }: { kind: SourceKind }) {
  const { t, i18n } = useTranslation(['sources', 'finance']);
  const session = useOutletContext<Session>();
  const context = useFinancialContext(session.user.id);
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [recurrence, setRecurrence] = useState<'monthly' | 'once'>('monthly');
  const [filterKind, setFilterKind] = useState<z.output<typeof filterKindSchema>>('all');
  const [accountId, setAccountId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const accountOptions = useQuery({
    queryKey: ['destinations', session.user.id, accountSearch],
    enabled: filtersOpen,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/accounts', {
          signal,
          params: { query: { q: accountSearch, pageSize: 100, includeArchived: 'true' } },
        }),
      ),
  });
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [archiving, setArchiving] = useState<IncomeRecord | CommitmentRecord | null>(null);
  const rows = useQuery({
    queryKey: [
      kind,
      session.user.id,
      page,
      month,
      q,
      includeArchived,
      recurrence,
      filterKind,
      accountId,
    ],
    queryFn: async ({ signal }) => {
      const query = {
        page,
        pageSize: 25,
        q,
        kind: filterKind,
        accountId,
        includeArchived: includeArchived ? ('true' as const) : ('false' as const),
        ...(month ? { month } : {}),
      };
      if (kind === 'income')
        return recurrence === 'once'
          ? requireData(await api.GET('/api/v1/income-entries', { signal, params: { query } }))
          : requireData(await api.GET('/api/v1/income-sources', { signal, params: { query } }));
      return requireData(await api.GET('/api/v1/commitments', { signal, params: { query } }));
    },
  });
  const activeMonth = month || rows.data?.month || context.data?.month || '';
  return (
    <>
      <header className="financial-page-heading">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t(kind === 'income' ? 'incomeTitle' : 'commitmentsTitle')}</h1>
          <p>{t(kind === 'income' ? 'incomeDescription' : 'commitmentsDescription')}</p>
        </div>
        <Button disabled={!context.data} onClick={() => setEditing({ id: null })}>
          {t(kind === 'income' ? 'createIncome' : 'createCommitment')}
        </Button>
      </header>
      <div className="data-toolbar">
        <Field id="source-search" label={t('finance:search')}>
          <Input
            id="source-search"
            type="search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field id="source-month" label={t('previewMonth')}>
          <Input
            id="source-month"
            type="month"
            value={activeMonth}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(1);
            }}
          />
        </Field>
        {kind === 'income' && (
          <Field id="income-recurrence-filter" label={t('recurrence')}>
            <select
              id="income-recurrence-filter"
              className="form-input"
              value={recurrence}
              onChange={(event) => {
                setRecurrence(event.target.value === 'once' ? 'once' : 'monthly');
                setPage(1);
              }}
            >
              <option value="monthly">{t('monthly')}</option>
              <option value="once">{t('once')}</option>
            </select>
          </Field>
        )}
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => {
              setIncludeArchived(event.target.checked);
              setPage(1);
            }}
          />
          {t('finance:includeArchived')}
        </label>
      </div>
      <details
        className="source-filters"
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary>
          {t('filters', { count: Number(filterKind !== 'all') + Number(accountId !== '') })}
        </summary>
        <div className="source-filter-fields">
          <Field id="source-kind-filter" label={t('kind')}>
            <select
              id="source-kind-filter"
              className="form-input"
              value={filterKind}
              onChange={(event) => {
                setFilterKind(filterKindSchema.parse(event.target.value));
                setPage(1);
              }}
            >
              <option value="all">{t('allTypes')}</option>
              {(kind === 'income'
                ? (['salary', 'professional'] as const)
                : ([
                    'fixed',
                    'subscription',
                    'professional',
                    'shared',
                    'financing',
                    'investment',
                  ] as const)
              ).map((value) => (
                <option key={value} value={value}>
                  {t(
                    `kinds.${kind === 'income' && value === 'professional' ? 'professionalIncome' : value}`,
                  )}
                </option>
              ))}
            </select>
          </Field>
          <Field id="filter-account-search" label={t('finance:searchAccount')}>
            <Input
              id="filter-account-search"
              type="search"
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
            />
          </Field>
          <Field id="source-account-filter" label={t('finance:account')}>
            <select
              id="source-account-filter"
              className="form-input"
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allAccounts')}</option>
              {accountId && !accountOptions.data?.items.some((item) => item.id === accountId) && (
                <option value={accountId}>{t('finance:currentDestination')}</option>
              )}
              {accountOptions.data?.items.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          {accountOptions.data && accountOptions.data.total > 100 && (
            <p className="field-hint">{t('finance:refineSearch')}</p>
          )}
          {accountOptions.isError && (
            <p role="alert" className="field-error">
              {t('finance:destinationLoadError')}
            </p>
          )}
        </div>
      </details>
      {context.isError && <ConnectionError retry={() => void context.refetch()} />}
      {rows.isPending ? (
        <LoadingState />
      ) : rows.isError ? (
        <ConnectionError retry={() => void rows.refetch()} />
      ) : rows.data.items.length === 0 ? (
        <section className="data-empty">
          <h2>{t('emptyTitle')}</h2>
          <p>{t('emptyDescription')}</p>
          <Button disabled={!context.data} onClick={() => setEditing({ id: null })}>
            {t(kind === 'income' ? 'createIncome' : 'createCommitment')}
          </Button>
        </section>
      ) : (
        <div className="source-list">
          {rows.data.items.map((row) => {
            const income = 'calculation' in row;
            const active = income ? row.active : row.projection.active;
            const amount = income ? row.calculation.spendableIncome : row.projection.monthlyCharge;
            const archived = row.archivedFromMonth !== null && row.archivedFromMonth <= activeMonth;
            const label = income
              ? row.revision.input.kind === 'salary'
                ? 'salary'
                : 'professionalIncome'
              : row.revision.input.kind;
            return (
              <article className="source-card" key={row.id}>
                <div className="source-card-main">
                  <span className="account-emblem" aria-hidden="true">
                    {income ? '↙' : '◷'}
                  </span>
                  <div>
                    <h2>{row.revision.input.name}</h2>
                    <p>
                      {t(`kinds.${label}`)} · {row.revision.input.effectiveFromMonth}
                    </p>
                    <span className={`record-status ${active ? 'record-status--active' : ''}`}>
                      {t(archived ? 'archived' : active ? 'active' : 'notActive')}
                    </span>
                  </div>
                </div>
                <div className="source-card-value">
                  <strong>{formatMoney(amount, i18n.resolvedLanguage)}</strong>
                  <span>{t(income ? 'calculation.spendableIncome' : 'monthlyImpact')}</span>
                </div>
                <div className="record-actions">
                  <Button
                    variant="outline"
                    disabled={!context.data}
                    onClick={() => setEditing({ id: row.id })}
                  >
                    {t(archived ? 'finance:view' : 'finance:edit')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={row.archivedFromMonth !== null}
                    onClick={() => setArchiving(row)}
                  >
                    {t('finance:archive')}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {rows.data && (
        <Pagination
          page={page}
          pageSize={rows.data.pageSize}
          total={rows.data.total}
          onChange={setPage}
        />
      )}
      {editing && context.data && (
        <SourceEditor
          kind={kind}
          id={editing.id}
          userId={session.user.id}
          context={{
            month: activeMonth,
            today: activeMonth === context.data.month ? context.data.today : `${activeMonth}-01`,
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {archiving && (
        <SourceArchive
          kind={kind}
          source={archiving}
          userId={session.user.id}
          month={activeMonth}
          onClose={() => setArchiving(null)}
        />
      )}
    </>
  );
}

function SourceArchive({
  kind,
  source,
  userId,
  month,
  onClose,
}: {
  kind: SourceKind;
  source: IncomeRecord | CommitmentRecord;
  userId: string;
  month: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['sources', 'finance']);
  const [fromMonth, setFromMonth] = useState(month);
  const archive = useMutation({
    mutationFn: async () => {
      const options = {
        params: { path: { id: source.id }, header: csrfHeaders() },
        body: { expectedVersion: source.version, archivedFromMonth: fromMonth },
      };
      requireSuccess(
        kind === 'income'
          ? await api.POST('/api/v1/income-sources/{id}/archive', options)
          : await api.POST('/api/v1/commitments/{id}/archive', options),
      );
    },
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({ queryKey: [kind, userId] });
    },
  });
  return (
    <ResourceDialog
      title={t('archiveTitle', { name: source.revision.input.name })}
      onClose={onClose}
      busy={archive.isPending}
    >
      <p className="form-intro">{t('archiveHint')}</p>
      <Field id="source-archive-month" label={t('finance:effectiveMonth')}>
        <Input
          id="source-archive-month"
          type="month"
          disabled={archive.isPending}
          value={fromMonth}
          onChange={(event) => setFromMonth(event.target.value)}
        />
      </Field>
      {archive.isError && <FinanceError error={archive.error} />}
      <div className="dialog-actions">
        <Button variant="outline" disabled={archive.isPending} onClick={onClose}>
          {t('finance:cancel')}
        </Button>
        <Button disabled={!fromMonth || archive.isPending} onClick={() => archive.mutate()}>
          {t('finance:archive')}
        </Button>
      </div>
    </ResourceDialog>
  );
}
