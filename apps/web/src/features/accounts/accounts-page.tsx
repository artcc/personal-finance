import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { components } from '@personal-finance/api-client';
import type { Session } from '../auth/session';
import { queryClient } from '../../app/query-client';
import { api } from '../../lib/api';
import { ApiError, requireData, requireSuccess } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { Field, FinanceError, Pagination, ResourceDialog } from '../finance/shared';
import { useFinancialContext } from '../finance/use-financial-context';

type Account = components['schemas']['AccountDto'];
type Space = components['schemas']['SpaceDto'];
type ArchivePreview = components['schemas']['ArchivePreviewDto'];
type EditTarget =
  | { kind: 'account'; account: Account | null }
  | { kind: 'space'; account: Account; space: Space | null };
type ArchiveTarget = { kind: 'account'; record: Account } | { kind: 'space'; record: Space };
const accountSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'invalidInput'),
  institution: z.string().trim().max(120, 'invalidInput'),
  reference: z.string().trim().max(120, 'invalidInput'),
});

async function refreshAccounts(userId: string) {
  await queryClient.invalidateQueries({
    predicate: (query) =>
      ['accounts', 'spaces', 'destinations'].includes(String(query.queryKey[0])) &&
      query.queryKey[1] === userId,
  });
}

export function AccountsPage() {
  const { t } = useTranslation(['accounts', 'finance']);
  const session = useOutletContext<Session>();
  const context = useFinancialContext(session.user.id);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [archiving, setArchiving] = useState<ArchiveTarget | null>(null);
  const accounts = useQuery({
    queryKey: ['accounts', session.user.id, page, q, includeArchived],
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/accounts', {
          signal,
          params: {
            query: { page, pageSize: 25, q, includeArchived: includeArchived ? 'true' : 'false' },
          },
        }),
      ),
  });
  return (
    <>
      <header className="financial-page-heading">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
        </div>
        <Button onClick={() => setEditing({ kind: 'account', account: null })}>
          {t('createAccount')}
        </Button>
      </header>
      <div className="data-toolbar">
        <Field id="account-search" label={t('finance:search')}>
          <Input
            id="account-search"
            type="search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </Field>
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
      {accounts.isPending ? (
        <LoadingState />
      ) : accounts.isError ? (
        <ConnectionError retry={() => void accounts.refetch()} />
      ) : accounts.data.items.length === 0 ? (
        <section className="data-empty">
          <h2>{t('emptyTitle')}</h2>
          <p>{t('emptyDescription')}</p>
          <Button onClick={() => setEditing({ kind: 'account', account: null })}>
            {t('createAccount')}
          </Button>
        </section>
      ) : (
        <div className="account-grid">
          {accounts.data.items.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              userId={session.user.id}
              month={accounts.data.month}
              onEdit={setEditing}
              onArchive={setArchiving}
            />
          ))}
        </div>
      )}
      {accounts.data && (
        <Pagination
          page={page}
          pageSize={accounts.data.pageSize}
          total={accounts.data.total}
          onChange={setPage}
        />
      )}
      {editing && (
        <AccountEditor target={editing} userId={session.user.id} onClose={() => setEditing(null)} />
      )}
      {archiving && (
        <ArchiveEditor
          target={archiving}
          userId={session.user.id}
          defaultMonth={context.data?.month ?? accounts.data?.month ?? ''}
          onClose={() => setArchiving(null)}
        />
      )}
    </>
  );
}

function AccountCard({
  account,
  userId,
  month,
  onEdit,
  onArchive,
}: {
  account: Account;
  userId: string;
  month: string;
  onEdit: (target: EditTarget) => void;
  onArchive: (target: ArchiveTarget) => void;
}) {
  const { t } = useTranslation(['accounts', 'finance']);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const spaces = useQuery({
    queryKey: ['spaces', userId, account.id, page],
    enabled: expanded,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/accounts/{id}/spaces', {
          signal,
          params: {
            path: { id: account.id },
            query: { page, pageSize: 25, includeArchived: 'true' },
          },
        }),
      ),
  });
  return (
    <article className="account-card">
      <div className="account-card-heading">
        <span className="account-emblem" aria-hidden="true">
          ▤
        </span>
        <div>
          <h2>{account.name}</h2>
          <p>
            {[account.institution, account.reference].filter(Boolean).join(' · ') ||
              t('noReference')}
          </p>
        </div>
        <span className="stage-badge">{account.currency}</span>
      </div>
      {account.archivedFromMonth && (
        <p className="record-status">
          {t(
            account.archivedFromMonth <= month
              ? 'finance:archivedFrom'
              : 'finance:archiveScheduled',
            { month: account.archivedFromMonth },
          )}
        </p>
      )}
      <div className="record-actions">
        <Button
          variant="outline"
          disabled={account.archivedFromMonth !== null}
          onClick={() => onEdit({ kind: 'account', account })}
        >
          {t('finance:edit')}
        </Button>
        <Button
          variant="outline"
          disabled={account.archivedFromMonth !== null}
          onClick={() => onArchive({ kind: 'account', record: account })}
        >
          {t('finance:archive')}
        </Button>
        <Button variant="outline" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {t('spacesCount', { count: account.spaceCount })}
        </Button>
      </div>
      {expanded && (
        <section className="account-spaces" aria-label={t('spacesFor', { name: account.name })}>
          <div className="section-heading">
            <h3>{t('spacesTitle')}</h3>
            <Button
              variant="outline"
              disabled={account.archivedFromMonth !== null || account.spaceCount >= 100}
              onClick={() => onEdit({ kind: 'space', account, space: null })}
            >
              {t('createSpace')}
            </Button>
          </div>
          {spaces.isPending ? (
            <LoadingState />
          ) : spaces.isError ? (
            <ConnectionError retry={() => void spaces.refetch()} />
          ) : (
            <>
              <ul className="space-list">
                {spaces.data.items.map((space) => (
                  <li key={space.id}>
                    <div>
                      <strong>{space.name}</strong>
                      {space.archivedFromMonth && (
                        <p className="field-hint">
                          {t('finance:archivedFrom', { month: space.archivedFromMonth })}
                        </p>
                      )}
                    </div>
                    <div className="record-actions">
                      <Button
                        variant="outline"
                        disabled={
                          space.archivedFromMonth !== null || account.archivedFromMonth !== null
                        }
                        onClick={() => onEdit({ kind: 'space', account, space })}
                      >
                        {t('finance:edit')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          space.archivedFromMonth !== null || account.archivedFromMonth !== null
                        }
                        onClick={() => onArchive({ kind: 'space', record: space })}
                      >
                        {t('finance:archive')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {spaces.data.total === 0 && <p className="field-hint">{t('noSpaces')}</p>}
              <Pagination
                page={page}
                pageSize={spaces.data.pageSize}
                total={spaces.data.total}
                onChange={setPage}
              />
            </>
          )}
        </section>
      )}
    </article>
  );
}

function AccountEditor({
  target,
  userId,
  onClose,
}: {
  target: EditTarget;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['accounts', 'finance']);
  const record = target.kind === 'account' ? target.account : target.space;
  const form = useForm<z.input<typeof accountSchema>, unknown, z.output<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: record?.name ?? '',
      institution: target.kind === 'account' ? (target.account?.institution ?? '') : '',
      reference: target.kind === 'account' ? (target.account?.reference ?? '') : '',
    },
  });
  const save = useMutation({
    mutationFn: async (values: z.output<typeof accountSchema>) => {
      if (target.kind === 'account') {
        const input = {
          name: values.name,
          institution: values.institution || null,
          reference: values.reference || null,
          currency: 'EUR' as const,
        };
        return target.account
          ? requireData(
              await api.PATCH('/api/v1/accounts/{id}', {
                params: { path: { id: target.account.id }, header: csrfHeaders() },
                body: { ...input, expectedVersion: target.account.version },
              }),
            )
          : requireData(
              await api.POST('/api/v1/accounts', {
                params: { header: csrfHeaders() },
                body: input,
              }),
            );
      }
      return target.space
        ? requireData(
            await api.PATCH('/api/v1/spaces/{id}', {
              params: { path: { id: target.space.id }, header: csrfHeaders() },
              body: { name: values.name, expectedVersion: target.space.version },
            }),
          )
        : requireData(
            await api.POST('/api/v1/accounts/{id}/spaces', {
              params: { path: { id: target.account.id }, header: csrfHeaders() },
              body: { name: values.name },
            }),
          );
    },
    onSuccess: async () => {
      await refreshAccounts(userId);
      onClose();
    },
  });
  return (
    <ResourceDialog
      title={t(
        record ? 'finance:edit' : target.kind === 'account' ? 'createAccount' : 'createSpace',
      )}
      onClose={onClose}
      busy={save.isPending}
    >
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))} noValidate>
        <fieldset disabled={save.isPending}>
          <Field id="resource-name" label={t('name')} error={form.formState.errors.name?.message}>
            <Input
              id="resource-name"
              required
              maxLength={120}
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? 'resource-name-error' : undefined}
              {...form.register('name')}
            />
          </Field>
          {target.kind === 'account' && (
            <>
              <Field
                id="institution"
                label={t('institution')}
                error={form.formState.errors.institution?.message}
              >
                <Input id="institution" maxLength={120} {...form.register('institution')} />
              </Field>
              <Field
                id="reference"
                label={t('reference')}
                hint={t('referenceHint')}
                error={form.formState.errors.reference?.message}
              >
                <Input id="reference" maxLength={120} {...form.register('reference')} />
              </Field>
              <p className="field-hint">{t('currencyHint')}</p>
            </>
          )}
          {save.isError && <FinanceError error={save.error} />}
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t(save.isPending ? 'finance:saving' : 'finance:save')}
            </Button>
          </div>
        </fieldset>
      </form>
    </ResourceDialog>
  );
}

function ArchiveEditor({
  target,
  userId,
  defaultMonth,
  onClose,
}: {
  target: ArchiveTarget;
  userId: string;
  defaultMonth: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['accounts', 'finance']);
  const [month, setMonth] = useState(defaultMonth);
  const [previewResult, setReviewed] = useState<ArchivePreview | null>(null);
  const reviewed = previewResult?.archivedFromMonth === month ? previewResult : null;
  const preview = useMutation({
    mutationFn: async () => {
      const options = {
        params: { path: { id: target.record.id }, header: csrfHeaders() },
        body: { archivedFromMonth: month },
      };
      return target.kind === 'account'
        ? requireData(await api.POST('/api/v1/accounts/{id}/archive-preview', options))
        : requireData(await api.POST('/api/v1/spaces/{id}/archive-preview', options));
    },
    onSuccess: setReviewed,
  });
  const archive = useMutation({
    mutationFn: async () => {
      if (!reviewed) throw new ApiError('INVALID_FINANCIAL_INPUT');
      const options = {
        params: { path: { id: target.record.id }, header: csrfHeaders() },
        body: {
          expectedVersion: reviewed.expectedVersion,
          archivedFromMonth: reviewed.archivedFromMonth,
          spaceIds: reviewed.spaceIds,
        },
      };
      requireSuccess(
        target.kind === 'account'
          ? await api.POST('/api/v1/accounts/{id}/archive', options)
          : await api.POST('/api/v1/spaces/{id}/archive', options),
      );
    },
    onSuccess: async () => {
      await refreshAccounts(userId);
      onClose();
    },
  });
  return (
    <ResourceDialog
      title={t('archiveTitle', { name: target.record.name })}
      onClose={onClose}
      busy={preview.isPending || archive.isPending}
    >
      <p className="form-intro">{t('archiveDescription')}</p>
      <Field id="archive-month" label={t('finance:effectiveMonth')}>
        <Input
          id="archive-month"
          type="month"
          disabled={preview.isPending || archive.isPending}
          value={month}
          onChange={(event) => {
            setMonth(event.target.value);
            setReviewed(null);
          }}
        />
      </Field>
      {(preview.isError || archive.isError) && (
        <FinanceError error={preview.error ?? archive.error} />
      )}
      {reviewed && (
        <section className="archive-review">
          <h3>{t('archiveSpaces', { count: reviewed.spaces.length })}</h3>
          <ul>
            {reviewed.spaces.map((space) => (
              <li key={space.id}>{space.name}</li>
            ))}
          </ul>
          {reviewed.referenceCount > 0 && (
            <>
              <p role="alert">{t('archiveBlocked', { count: reviewed.referenceCount })}</p>
              <ul>
                {reviewed.references.map((reference) => (
                  <li key={`${reference.kind}-${reference.id}`}>{reference.name}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <div className="dialog-actions">
        <Button
          variant="outline"
          disabled={preview.isPending || archive.isPending}
          onClick={onClose}
        >
          {t('finance:cancel')}
        </Button>
        {!reviewed ? (
          <Button disabled={!month || preview.isPending} onClick={() => preview.mutate()}>
            {t('reviewArchive')}
          </Button>
        ) : (
          <Button
            disabled={reviewed.referenceCount > 0 || archive.isPending}
            onClick={() => archive.mutate()}
          >
            {t('confirmArchive')}
          </Button>
        )}
      </div>
    </ResourceDialog>
  );
}
