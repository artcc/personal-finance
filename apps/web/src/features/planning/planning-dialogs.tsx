import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { Field, FinanceError, ResourceDialog } from '../finance/shared';
import { formatMoney, moneyInput, parseMoneyInput } from '../finance/presentation';
import { acceptPlan } from './planning-api';
import type { MonthlyPlan, PlanCharge, PlanIncome } from './planning-api';

export function PlanLifecycleDialog({
  plan,
  userId,
  onClose,
  mode,
}: {
  plan: MonthlyPlan;
  userId: string;
  onClose: () => void;
  mode: 'close' | 'reopen' | 'suggest';
}) {
  const { t, i18n } = useTranslation(['planning', 'finance']);
  const schema = z
    .object({ reason: z.string(), acknowledge: z.boolean() })
    .superRefine((value, context) => {
      if (mode === 'reopen' && (!value.reason.trim() || value.reason.length > 500))
        context.addIssue({ code: 'custom', path: ['reason'], message: 'required' });
    });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '', acknowledge: false },
  });
  const shortfall =
    BigInt(plan.summary.plannedAvailability.minorUnits) < 0n ||
    BigInt(plan.summary.fundingGap.minorUnits) > 0n;
  const change = useMutation({
    mutationFn: async (values: z.output<typeof schema>) => {
      const params = { path: { id: plan.id }, header: csrfHeaders() };
      if (mode === 'close')
        return requireData(
          await api.POST('/api/v1/monthly-plans/{id}/close', {
            params,
            body: { expectedVersion: plan.version, acknowledgeShortfall: values.acknowledge },
          }),
        );
      if (mode === 'reopen')
        return requireData(
          await api.POST('/api/v1/monthly-plans/{id}/reopen', {
            params,
            body: { expectedVersion: plan.version, reason: values.reason },
          }),
        );
      return requireData(
        await api.POST('/api/v1/monthly-plans/{id}/allocations/suggest', {
          params,
          body: { expectedVersion: plan.version },
        }),
      );
    },
    onSuccess: async (data) => {
      await acceptPlan(userId, data);
      onClose();
    },
  });
  return (
    <ResourceDialog title={t(`${mode}Title`)} busy={change.isPending} onClose={onClose}>
      <p className="form-intro">{t(`${mode}Hint`)}</p>
      <form onSubmit={form.handleSubmit((values) => change.mutate(values))} noValidate>
        <fieldset disabled={change.isPending}>
          {mode === 'close' && (
            <>
              <dl className="preview-values">
                <div>
                  <dt>{t('availability')}</dt>
                  <dd>{formatMoney(plan.summary.plannedAvailability, i18n.resolvedLanguage)}</dd>
                </div>
                <div>
                  <dt>{t('unallocated')}</dt>
                  <dd>{formatMoney(plan.summary.unallocatedCash, i18n.resolvedLanguage)}</dd>
                </div>
                <div>
                  <dt>{t('fundingGap')}</dt>
                  <dd>{formatMoney(plan.summary.fundingGap, i18n.resolvedLanguage)}</dd>
                </div>
              </dl>
              {shortfall && (
                <label className="checkbox-field">
                  <input type="checkbox" {...form.register('acknowledge')} />
                  {t('acknowledgeShortfall')}
                </label>
              )}
            </>
          )}
          {mode === 'reopen' && (
            <Field
              id="reopen-reason"
              label={t('reason')}
              error={form.formState.errors.reason?.message}
            >
              <textarea
                id="reopen-reason"
                className="form-input"
                rows={3}
                maxLength={500}
                required
                {...form.register('reason')}
              />
            </Field>
          )}
          {change.isError && <FinanceError error={change.error} />}
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button type="submit" disabled={change.isPending}>
              {t(`${mode}Action`)}
            </Button>
          </div>
        </fieldset>
      </form>
    </ResourceDialog>
  );
}

export function PlanOverrideDialog({
  plan,
  line,
  userId,
  onClose,
}: {
  plan: MonthlyPlan;
  line: PlanIncome | PlanCharge;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['planning', 'finance']);
  const income = 'expectedCash' in line;
  const schema = z
    .object({
      amount: z.string(),
      reserve: z.string(),
      reason: z.string().trim().min(1, 'required').max(500, 'invalidInput'),
    })
    .superRefine((value, context) => {
      for (const key of income ? (['amount', 'reserve'] as const) : (['amount'] as const)) {
        try {
          parseMoneyInput(value[key]);
        } catch {
          context.addIssue({ code: 'custom', path: [key], message: 'invalidMoney' });
        }
      }
    });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: moneyInput(income ? line.expectedCash : line.amount),
      reserve: income ? moneyInput(line.taxReserve) : '0,00',
      reason: line.overrideReason ?? '',
    },
  });
  const update = useMutation({
    mutationFn: async ({
      values,
      restore,
    }: {
      values: z.output<typeof schema>;
      restore: boolean;
    }) => {
      const params = { path: { id: plan.id, lineId: line.id }, header: csrfHeaders() };
      return restore
        ? requireData(
            await api.DELETE('/api/v1/monthly-plans/{id}/overrides/{lineId}', {
              params,
              body: { expectedVersion: plan.version, reason: values.reason },
            }),
          )
        : requireData(
            await api.PUT('/api/v1/monthly-plans/{id}/overrides/{lineId}', {
              params,
              body: {
                expectedVersion: plan.version,
                reason: values.reason,
                amount: parseMoneyInput(values.amount),
                taxReserve: income ? parseMoneyInput(values.reserve) : null,
              },
            }),
          );
    },
    onSuccess: async (data) => {
      await acceptPlan(userId, data);
      onClose();
    },
  });
  return (
    <ResourceDialog
      title={t('overrideTitle', { name: line.name })}
      busy={update.isPending}
      onClose={onClose}
    >
      <p className="form-intro">{t(income ? 'incomeOverrideHint' : 'chargeOverrideHint')}</p>
      <form
        onSubmit={form.handleSubmit((values) => update.mutate({ values, restore: false }))}
        noValidate
      >
        <fieldset disabled={update.isPending}>
          <Field
            id="override-amount"
            label={t(income ? 'expectedCash' : 'monthlyCharge')}
            error={form.formState.errors.amount?.message}
          >
            <Input
              id="override-amount"
              inputMode="decimal"
              maxLength={32}
              {...form.register('amount')}
            />
          </Field>
          {income && (
            <Field
              id="override-reserve"
              label={t('taxReserve')}
              error={form.formState.errors.reserve?.message}
            >
              <Input
                id="override-reserve"
                inputMode="decimal"
                maxLength={32}
                {...form.register('reserve')}
              />
            </Field>
          )}
          <Field
            id="override-reason"
            label={t('reason')}
            error={form.formState.errors.reason?.message}
          >
            <textarea
              id="override-reason"
              className="form-input"
              rows={3}
              required
              maxLength={500}
              {...form.register('reason')}
            />
          </Field>
          {update.isError && <FinanceError error={update.error} />}
          <div className="dialog-actions">
            {line.overrideReason && (
              <Button
                variant="outline"
                onClick={() =>
                  void form.handleSubmit((values) => update.mutate({ values, restore: true }))()
                }
              >
                {t('restore')}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button type="submit">{t('saveOverride')}</Button>
          </div>
        </fieldset>
      </form>
    </ResourceDialog>
  );
}

export function PlanRefreshDialog({
  plan,
  userId,
  onClose,
}: {
  plan: MonthlyPlan;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['planning', 'finance']);
  const [discard, setDiscard] = useState<string[]>([]);
  const [reset, setReset] = useState(false);
  const preview = useQuery({
    queryKey: ['plan-refresh', userId, plan.id, plan.version],
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      requireData(
        await api.POST('/api/v1/monthly-plans/{id}/refresh-preview', {
          signal,
          params: { path: { id: plan.id }, header: csrfHeaders() },
          body: { expectedVersion: plan.version },
        }),
      ),
  });
  const refresh = useMutation({
    mutationFn: async () => {
      if (!preview.data) throw new Error('Missing refresh preview');
      return requireData(
        await api.POST('/api/v1/monthly-plans/{id}/refresh', {
          params: { path: { id: plan.id }, header: csrfHeaders() },
          body: {
            expectedVersion: preview.data.expectedVersion,
            inputFingerprint: preview.data.inputFingerprint,
            discardOverrideIds: discard,
            resetAllocations: reset,
          },
        }),
      );
    },
    onSuccess: async (data) => {
      await acceptPlan(userId, data);
      onClose();
    },
  });
  const resolved =
    preview.data &&
    preview.data.overrideConflicts.every((item) => discard.includes(item.lineId)) &&
    (preview.data.allocationConflicts.length === 0 || reset);
  return (
    <ResourceDialog title={t('refreshTitle')} busy={refresh.isPending} onClose={onClose}>
      {preview.isPending ? (
        <LoadingState />
      ) : preview.isError ? (
        <ConnectionError retry={() => void preview.refetch()} />
      ) : (
        <>
          <p className="form-intro">{t('refreshHint')}</p>
          {(['added', 'removed', 'changed'] as const).map((key) => (
            <section className="refresh-section" key={key}>
              <h3>{t(`refresh.${key}`, { count: preview.data[key].length })}</h3>
              <ul>
                {preview.data[key].map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </ul>
            </section>
          ))}
          {preview.data.overrideConflicts.map((item) => (
            <label className="checkbox-field" key={item.lineId}>
              <input
                type="checkbox"
                checked={discard.includes(item.lineId)}
                onChange={(event) =>
                  setDiscard(
                    event.target.checked
                      ? [...discard, item.lineId]
                      : discard.filter((id) => id !== item.lineId),
                  )
                }
              />
              {t('discardOverride', { name: item.name })}
            </label>
          ))}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={reset}
              onChange={(event) => setReset(event.target.checked)}
            />
            {t('resetDuringRefresh')}
          </label>
          {preview.data.allocationConflicts.length > 0 && (
            <p className="field-error">{t('refreshAllocationConflict')}</p>
          )}
          {refresh.isError && <FinanceError error={refresh.error} />}
          <div className="dialog-actions">
            <Button variant="outline" disabled={refresh.isPending} onClick={onClose}>
              {t('finance:cancel')}
            </Button>
            <Button disabled={!resolved || refresh.isPending} onClick={() => refresh.mutate()}>
              {t('refreshAction')}
            </Button>
          </div>
        </>
      )}
    </ResourceDialog>
  );
}
