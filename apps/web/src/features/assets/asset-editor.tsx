import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { components } from '@personal-finance/api-client';
import { api } from '../../lib/api';
import { ApiError, requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Field, FinanceError, ResourceDialog } from '../finance/shared';
import { DestinationPicker } from '../finance/destination-picker';
import { moneyInput, parseMoneyInput } from '../finance/presentation';
import { refreshAssets } from './asset-api';
import type { AssetKind, Financing, Investment } from './asset-api';

const baseSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'invalidInput'),
  organization: z.string().trim().max(120, 'invalidInput'),
  principal: z.string(),
  ticker: z.string().trim().max(30, 'invalidInput'),
  kind: z.enum(['fund', 'pension', 'crypto', 'other']),
  mode: z.enum(['contributions', 'units']),
  planMode: z.enum(['none', 'create', 'existing']),
  sourceId: z.string(),
  monthlyAmount: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  dueDay: z.string(),
  accountId: z.string(),
  spaceId: z.string(),
});

export function AssetEditor({
  kind,
  existing,
  userId,
  context,
  onClose,
}: {
  kind: AssetKind;
  existing: Financing | Investment | null;
  userId: string;
  context: { today: string; month: string };
  onClose: () => void;
}) {
  const { t } = useTranslation(['assets', 'finance']);
  const [search, setSearch] = useState('');
  const canLink = !existing || (kind === 'investments' && existing.planning === null);
  const sources = useQuery({
    queryKey: ['commitments', userId, 'asset-picker', kind, search],
    enabled: canLink,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/commitments', {
          signal,
          params: {
            query: {
              kind: kind === 'financing' ? 'financing' : 'investment',
              q: search,
              pageSize: 100,
            },
          },
        }),
      ),
  });
  const schema = useMemo(
    () =>
      baseSchema.superRefine((value, context) => {
        const issue = (field: keyof z.output<typeof baseSchema>, message: string) =>
          context.addIssue({ code: 'custom', path: [field], message });
        if (kind === 'financing' && value.principal)
          try {
            parseMoneyInput(value.principal);
          } catch {
            issue('principal', 'invalidMoney');
          }
        if (!canLink) return;
        if (kind === 'financing' && value.planMode === 'none') issue('monthlyAmount', 'required');
        if (value.planMode === 'create') {
          try {
            parseMoneyInput(value.monthlyAmount);
          } catch {
            issue('monthlyAmount', 'invalidMoney');
          }
          if (!z.uuid().safeParse(value.accountId).success) issue('accountId', 'accountRequired');
          if (!z.iso.date().safeParse(value.startsOn).success) issue('startsOn', 'invalidDate');
          if (
            value.endsOn &&
            (!z.iso.date().safeParse(value.endsOn).success || value.endsOn < value.startsOn)
          )
            issue('endsOn', 'invalidDate');
          if (
            value.dueDay &&
            (!/^\d+$/.test(value.dueDay) || Number(value.dueDay) < 1 || Number(value.dueDay) > 31)
          )
            issue('dueDay', 'invalidDay');
        }
        if (value.planMode === 'existing' && !z.uuid().safeParse(value.sourceId).success)
          issue('sourceId', 'required');
      }),
    [kind, canLink],
  );
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      organization: existing
        ? 'lender' in existing
          ? (existing.lender ?? '')
          : (existing.platform ?? '')
        : '',
      principal: existing && 'lender' in existing ? moneyInput(existing.originalPrincipal) : '',
      ticker: existing && 'ticker' in existing ? (existing.ticker ?? '') : '',
      kind: existing && 'kind' in existing ? existing.kind : 'fund',
      mode: existing && 'mode' in existing ? existing.mode : 'contributions',
      planMode: kind === 'financing' ? 'create' : 'none',
      sourceId: '',
      monthlyAmount: '0,00',
      startsOn: context.today,
      endsOn: '',
      dueDay: '',
      accountId: '',
      spaceId: '',
    },
  });
  const watched = useWatch({ control: form.control });
  const save = useMutation({
    mutationFn: async (values: z.output<typeof schema>) => {
      let planning: components['schemas']['PlanningLinkInputDto'] | null = null;
      if (canLink && values.planMode === 'existing') {
        const source = sources.data?.items.find((item) => item.id === values.sourceId);
        if (!source) throw new ApiError('COMMITMENT_NOT_FOUND');
        planning = { sourceId: source.id, expectedVersion: source.version, definition: null };
      } else if (canLink && values.planMode === 'create')
        planning = {
          sourceId: null,
          expectedVersion: null,
          definition: {
            name: values.name,
            kind: kind === 'financing' ? 'financing' : 'investment',
            frequency: 'monthly',
            amount: parseMoneyInput(values.monthlyAmount),
            effectiveFromMonth: values.startsOn.slice(0, 7),
            startsOn: values.startsOn,
            endsOn: values.endsOn || null,
            dueDay: values.dueDay ? Number(values.dueDay) : null,
            installments: [],
            destination: { accountId: values.accountId, spaceId: values.spaceId || null },
          },
        };
      if (kind === 'financing') {
        const input = {
          name: values.name,
          lender: values.organization || null,
          originalPrincipal: values.principal ? parseMoneyInput(values.principal) : null,
        };
        if (existing)
          return requireData(
            await api.PATCH('/api/v1/financings/{id}', {
              params: { path: { id: existing.id }, header: csrfHeaders() },
              body: { ...input, expectedVersion: existing.version },
            }),
          );
        if (!planning) throw new ApiError('INVALID_PLANNING_LINK');
        return requireData(
          await api.POST('/api/v1/financings', {
            params: { header: csrfHeaders() },
            body: { ...input, planning },
          }),
        );
      }
      const input = {
        name: values.name,
        platform: values.organization || null,
        ticker: values.ticker || null,
        kind: values.kind,
        planning,
      };
      return existing
        ? requireData(
            await api.PATCH('/api/v1/investments/{id}', {
              params: { path: { id: existing.id }, header: csrfHeaders() },
              body: { ...input, expectedVersion: existing.version },
            }),
          )
        : requireData(
            await api.POST('/api/v1/investments', {
              params: { header: csrfHeaders() },
              body: { ...input, mode: values.mode },
            }),
          );
    },
    onSuccess: async () => {
      onClose();
      await refreshAssets(userId);
    },
  });
  return (
    <ResourceDialog
      title={t(existing ? 'edit' : kind === 'financing' ? 'createFinancing' : 'createInvestment')}
      onClose={onClose}
      busy={save.isPending}
    >
      <form noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <fieldset disabled={save.isPending}>
          <Field id="asset-name" label={t('name')} error={form.formState.errors.name?.message}>
            <Input id="asset-name" required maxLength={120} {...form.register('name')} />
          </Field>
          <Field
            id="asset-organization"
            label={t(kind === 'financing' ? 'lender' : 'platform')}
            error={form.formState.errors.organization?.message}
          >
            <Input id="asset-organization" maxLength={120} {...form.register('organization')} />
          </Field>
          {kind === 'financing' ? (
            <Field
              id="original-principal"
              label={t('originalPrincipal')}
              hint={t('optional')}
              error={form.formState.errors.principal?.message}
            >
              <Input
                id="original-principal"
                inputMode="decimal"
                maxLength={32}
                {...form.register('principal')}
              />
            </Field>
          ) : (
            <>
              <div className="field-grid">
                <Field id="asset-kind" label={t('kind')}>
                  <select id="asset-kind" className="form-input" {...form.register('kind')}>
                    <option value="fund">{t('kinds.fund')}</option>
                    <option value="pension">{t('kinds.pension')}</option>
                    <option value="crypto">{t('kinds.crypto')}</option>
                    <option value="other">{t('kinds.other')}</option>
                  </select>
                </Field>
                <Field id="asset-ticker" label={t('ticker')}>
                  <Input id="asset-ticker" maxLength={30} {...form.register('ticker')} />
                </Field>
              </div>
              {!existing && (
                <Field id="investment-mode" label={t('recordingMode')} hint={t('modeHint')}>
                  <select id="investment-mode" className="form-input" {...form.register('mode')}>
                    <option value="contributions">{t('modes.contributions')}</option>
                    <option value="units">{t('modes.units')}</option>
                  </select>
                </Field>
              )}
            </>
          )}
          {canLink && (
            <section className="asset-plan-fields">
              <h3>{t(kind === 'financing' ? 'paymentPlan' : 'contributionPlan')}</h3>
              <Field id="asset-plan-mode" label={t('planningChoice')}>
                <select id="asset-plan-mode" className="form-input" {...form.register('planMode')}>
                  {kind === 'investments' && <option value="none">{t('noPlan')}</option>}
                  <option value="create">{t('newPlan')}</option>
                  <option value="existing">{t('existingPlan')}</option>
                </select>
              </Field>
              {watched.planMode === 'existing' ? (
                <>
                  <Field id="source-search" label={t('finance:search')}>
                    <Input
                      id="source-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </Field>
                  <Field
                    id="asset-source"
                    label={t('existingSource')}
                    error={form.formState.errors.sourceId?.message}
                  >
                    <select id="asset-source" className="form-input" {...form.register('sourceId')}>
                      <option value="">{t('chooseSource')}</option>
                      {sources.data?.items
                        .filter(
                          (item) =>
                            !item.managedKind &&
                            (kind !== 'financing' || item.revision.input.frequency === 'monthly'),
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.revision.input.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {sources.isError && <FinanceError error={sources.error} />}
                </>
              ) : (
                watched.planMode === 'create' && (
                  <>
                    <Field
                      id="asset-monthly-amount"
                      label={t(kind === 'financing' ? 'monthlyPayment' : 'monthlyContribution')}
                      error={form.formState.errors.monthlyAmount?.message}
                    >
                      <Input
                        id="asset-monthly-amount"
                        inputMode="decimal"
                        maxLength={32}
                        {...form.register('monthlyAmount')}
                      />
                    </Field>
                    <div className="field-grid">
                      <Field
                        id="asset-start"
                        label={t('startsOn')}
                        error={form.formState.errors.startsOn?.message}
                      >
                        <Input id="asset-start" type="date" {...form.register('startsOn')} />
                      </Field>
                      <Field
                        id="asset-end"
                        label={t('endsOn')}
                        error={form.formState.errors.endsOn?.message}
                      >
                        <Input id="asset-end" type="date" {...form.register('endsOn')} />
                      </Field>
                      <Field
                        id="asset-due-day"
                        label={t('dueDay')}
                        error={form.formState.errors.dueDay?.message}
                      >
                        <Input
                          id="asset-due-day"
                          inputMode="numeric"
                          maxLength={2}
                          {...form.register('dueDay')}
                        />
                      </Field>
                    </div>
                    <DestinationPicker
                      userId={userId}
                      accountId={watched.accountId ?? ''}
                      spaceId={watched.spaceId ?? ''}
                      error={form.formState.errors.accountId?.message}
                      onAccount={(value) => form.setValue('accountId', value)}
                      onSpace={(value) => form.setValue('spaceId', value)}
                    />
                  </>
                )
              )}
              <p className="field-hint">{t('noDuplicatePlan')}</p>
            </section>
          )}
          {existing?.planning && <p className="field-hint">{t('editPlanSeparately')}</p>}
          {save.isError && <FinanceError error={save.error} />}
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button type="submit">{t(save.isPending ? 'finance:saving' : 'finance:save')}</Button>
          </div>
        </fieldset>
      </form>
    </ResourceDialog>
  );
}
