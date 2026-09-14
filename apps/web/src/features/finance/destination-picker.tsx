import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { Input } from '../../components/ui/input';
import { Field } from './shared';

export function DestinationPicker({
  userId,
  accountId,
  spaceId,
  onAccount,
  onSpace,
  error,
  onLabel,
}: {
  userId: string;
  accountId: string;
  spaceId: string;
  onAccount: (id: string) => void;
  onSpace: (id: string) => void;
  error?: string | undefined;
  onLabel?: ((label: string) => void) | undefined;
}) {
  const { t } = useTranslation('finance');
  const [search, setSearch] = useState('');
  const accounts = useQuery({
    queryKey: ['destinations', userId, search],
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/accounts', {
          signal,
          params: { query: { pageSize: 100, includeArchived: 'true', q: search } },
        }),
      ),
  });
  const spaces = useQuery({
    queryKey: ['spaces', userId, accountId, 'picker'],
    enabled: accountId !== '',
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/accounts/{id}/spaces', {
          signal,
          params: { path: { id: accountId }, query: { pageSize: 100, includeArchived: 'true' } },
        }),
      ),
  });
  return (
    <div className="destination-fields">
      <Field id="destination-search" label={t('searchAccount')}>
        <Input
          id="destination-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <Field id="destination-account" label={t('account')} error={error}>
        <select
          id="destination-account"
          className="form-input"
          value={accountId}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'destination-account-error' : undefined}
          onChange={(event) => {
            onAccount(event.target.value);
            onSpace('');
            onLabel?.(
              accounts.data?.items.find((item) => item.id === event.target.value)?.name ??
                t('currentDestination'),
            );
          }}
        >
          <option value="">{t(accounts.isPending ? 'loading' : 'chooseAccount')}</option>
          {accountId && !accounts.data?.items.some((item) => item.id === accountId) && (
            <option value={accountId}>{t('currentDestination')}</option>
          )}
          {accounts.data?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.institution ? ` · ${item.institution}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field id="destination-space" label={t('space')}>
        <select
          id="destination-space"
          className="form-input"
          disabled={!accountId || spaces.isPending}
          value={spaceId}
          onChange={(event) => {
            onSpace(event.target.value);
            const account =
              accounts.data?.items.find((item) => item.id === accountId)?.name ??
              t('currentDestination');
            const space = spaces.data?.items.find((item) => item.id === event.target.value)?.name;
            onLabel?.(space ? `${account} / ${space}` : account);
          }}
        >
          <option value="">{t('directAccount')}</option>
          {spaces.data?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      {(accounts.isError || spaces.isError) && (
        <p className="field-error" role="alert">
          {t('destinationLoadError')}
        </p>
      )}
      {accounts.data && accounts.data.total > accounts.data.items.length && (
        <p className="field-hint">{t('refineSearch')}</p>
      )}
    </div>
  );
}
