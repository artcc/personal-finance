import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Field, FinanceError, ResourceDialog } from '../finance/shared';
import { parseMoneyInput } from '../finance/presentation';
import { refreshAssets } from './asset-api';
import type { AssetKind, Financing, Investment } from './asset-api';

export function ReportDialog({
  kind,
  record,
  userId,
  today,
  onClose,
}: {
  kind: AssetKind;
  record: Financing | Investment;
  userId: string;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['assets', 'finance']);
  const [expectedVersion] = useState(record.version);
  const schema = z
    .object({ asOf: z.iso.date({ error: 'invalidDate' }), amount: z.string() })
    .superRefine((value, context) => {
      if (value.asOf > today)
        context.addIssue({ code: 'custom', path: ['asOf'], message: 'invalidDate' });
      try {
        parseMoneyInput(value.amount);
      } catch {
        context.addIssue({ code: 'custom', path: ['amount'], message: 'invalidMoney' });
      }
    });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { asOf: today, amount: '' },
  });
  const save = useMutation({
    mutationFn: async (values: z.output<typeof schema>) => {
      const options = {
        params: { path: { id: record.id }, header: csrfHeaders() },
        body: {
          expectedVersion,
          asOf: values.asOf,
          amount: parseMoneyInput(values.amount),
        },
      };
      return kind === 'financing'
        ? requireData(await api.POST('/api/v1/financings/{id}/balances', options))
        : requireData(await api.POST('/api/v1/investments/{id}/valuations', options));
    },
    onSuccess: async () => {
      onClose();
      await refreshAssets(userId);
    },
  });
  return (
    <ResourceDialog
      title={t(kind === 'financing' ? 'reportDebt' : 'reportValuation')}
      onClose={onClose}
      busy={save.isPending}
    >
      <p className="form-intro">{t(kind === 'financing' ? 'debtHint' : 'valuationHint')}</p>
      <form onSubmit={form.handleSubmit((value) => save.mutate(value))} noValidate>
        <fieldset disabled={save.isPending}>
          <Field id="report-date" label={t('asOf')} error={form.formState.errors.asOf?.message}>
            <Input id="report-date" type="date" max={today} required {...form.register('asOf')} />
          </Field>
          <Field
            id="report-amount"
            label={t('amount')}
            error={form.formState.errors.amount?.message}
          >
            <Input
              id="report-amount"
              inputMode="decimal"
              maxLength={32}
              required
              {...form.register('amount')}
            />
          </Field>
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
