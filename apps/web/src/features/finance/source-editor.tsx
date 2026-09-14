import { useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { components } from '@personal-finance/api-client';
import { api } from '../../lib/api';
import { ApiError, requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { queryClient } from '../../app/query-client';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { Field, FinanceError, Pagination, ResourceDialog } from './shared';
import { DestinationPicker } from './destination-picker';
import {
  decimalInput,
  formatMoney,
  moneyInput,
  parseDecimalInput,
  parseMoneyInput,
} from './presentation';

export type IncomeRecord = components['schemas']['IncomeRecordDto'];
export type CommitmentRecord = components['schemas']['CommitmentRecordDto'];
type IncomeDefinition = components['schemas']['IncomeDefinitionDto'];
type CommitmentDefinition = components['schemas']['CommitmentDefinitionDto'];
export type SourceKind = 'income' | 'commitments';
type PreviewResult =
  components['schemas']['IncomeCalculationDto'] | components['schemas']['CommitmentProjectionDto'];

const baseSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'invalidInput'),
  effectiveFromMonth: z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/, 'invalidMonth'),
  startsOn: z.iso.date({ error: 'invalidDate' }),
  endsOn: z.string(),
  accountId: z.uuid({ error: 'accountRequired' }),
  spaceId: z.string(),
  recurrence: z.enum(['monthly', 'once']),
  incomeKind: z.enum(['salary', 'professional']),
  incomeMethod: z.enum(['fixed', 'hourly']),
  netSalary: z.string(),
  base: z.string(),
  hourlyRate: z.string(),
  hours: z.string(),
  vatRate: z.string(),
  withholdingRate: z.string(),
  commissionRate: z.string(),
  commitmentKind: z.enum([
    'fixed',
    'subscription',
    'professional',
    'shared',
    'financing',
    'investment',
  ]),
  frequency: z.enum(['monthly', 'annual']),
  amount: z.string(),
  dueDay: z.string(),
  installments: z.array(z.object({ month: z.string(), day: z.string(), amount: z.string() })),
  previewMonth: z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/, 'invalidMonth'),
});
type Values = z.output<typeof baseSchema>;
type SourceRequest =
  | { kind: 'income'; input: IncomeDefinition; recurrence: 'monthly' | 'once'; month: string }
  | { kind: 'commitments'; input: CommitmentDefinition; month: string };

function requestFrom(values: Values, kind: SourceKind): SourceRequest {
  const shared = {
    name: values.name,
    effectiveFromMonth: values.effectiveFromMonth,
    startsOn: values.startsOn,
    endsOn: values.endsOn || null,
    destination: { accountId: values.accountId, spaceId: values.spaceId || null },
  };
  if (kind === 'income') {
    const salary = values.incomeKind === 'salary';
    return {
      kind,
      recurrence: values.recurrence,
      month: values.previewMonth,
      input: {
        ...shared,
        kind: values.incomeKind,
        netSalary: salary ? parseMoneyInput(values.netSalary) : null,
        base: !salary && values.incomeMethod === 'fixed' ? parseMoneyInput(values.base) : null,
        hourlyRate:
          !salary && values.incomeMethod === 'hourly' ? parseDecimalInput(values.hourlyRate) : null,
        hours: !salary && values.incomeMethod === 'hourly' ? parseDecimalInput(values.hours) : null,
        vatRate: salary ? '0' : parseDecimalInput(values.vatRate, true),
        withholdingRate: salary ? '0' : parseDecimalInput(values.withholdingRate, true),
        commissionRate: salary ? '0' : parseDecimalInput(values.commissionRate, true),
      },
    };
  }
  return {
    kind,
    month: values.previewMonth,
    input: {
      ...shared,
      kind: values.commitmentKind,
      frequency: values.frequency,
      amount: parseMoneyInput(values.amount),
      dueDay: values.frequency === 'monthly' && values.dueDay ? Number(values.dueDay) : null,
      installments:
        values.frequency === 'annual'
          ? values.installments.map((item) => ({
              month: Number(item.month),
              day: Number(item.day),
              amount: parseMoneyInput(item.amount),
            }))
          : [],
    },
  };
}

function defaults(
  context: { month: string; today: string },
  existing: IncomeRecord | CommitmentRecord | null,
): Values {
  const result: Values = {
    name: '',
    effectiveFromMonth: context.month,
    startsOn: context.today,
    endsOn: '',
    accountId: '',
    spaceId: '',
    recurrence: 'monthly',
    incomeKind: 'salary',
    incomeMethod: 'fixed',
    netSalary: '0,00',
    base: '0,00',
    hourlyRate: '',
    hours: '',
    vatRate: '0',
    withholdingRate: '0',
    commissionRate: '0',
    commitmentKind: 'fixed',
    frequency: 'monthly',
    amount: '0,00',
    dueDay: '',
    installments: [],
    previewMonth: context.month,
  };
  if (!existing) return result;
  const input = existing.revision.input;
  Object.assign(result, {
    name: input.name,
    effectiveFromMonth:
      existing.archivedFromMonth !== null &&
      (context.month >= existing.archivedFromMonth ||
        input.effectiveFromMonth >= existing.archivedFromMonth)
        ? input.effectiveFromMonth
        : input.effectiveFromMonth > context.month
          ? input.effectiveFromMonth
          : context.month,
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? '',
    accountId: input.destination.accountId,
    spaceId: input.destination.spaceId ?? '',
  });
  if ('calculation' in existing) {
    const income = existing.revision.input;
    Object.assign(result, {
      recurrence: existing.recurrence,
      incomeKind: income.kind,
      incomeMethod: income.hourlyRate === null ? 'fixed' : 'hourly',
      netSalary: moneyInput(income.netSalary),
      base: moneyInput(income.base),
      hourlyRate: decimalInput(income.hourlyRate),
      hours: decimalInput(income.hours),
      vatRate: decimalInput(income.vatRate, true),
      withholdingRate: decimalInput(income.withholdingRate, true),
      commissionRate: decimalInput(income.commissionRate, true),
    });
    if (existing.oneOffMonth) result.effectiveFromMonth = existing.oneOffMonth;
  } else {
    const commitment = existing.revision.input;
    Object.assign(result, {
      commitmentKind: commitment.kind,
      frequency: commitment.frequency,
      amount: moneyInput(commitment.amount),
      dueDay: commitment.dueDay === null ? '' : String(commitment.dueDay),
      installments: commitment.installments.map((item) => ({
        month: String(item.month),
        day: String(item.day),
        amount: moneyInput(item.amount),
      })),
    });
  }
  return result;
}

export function SourceEditor({
  kind,
  id,
  userId,
  context,
  onClose,
}: {
  kind: SourceKind;
  id: string | null;
  userId: string;
  context: { month: string; today: string };
  onClose: () => void;
}) {
  const { t } = useTranslation('finance');
  const detail = useQuery({
    queryKey: [`${kind}-detail`, userId, id],
    enabled: id !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      if (!id) throw new ApiError('INVALID_FINANCIAL_INPUT');
      return kind === 'income'
        ? requireData(
            await api.GET('/api/v1/income-sources/{id}', { signal, params: { path: { id } } }),
          )
        : requireData(
            await api.GET('/api/v1/commitments/{id}', { signal, params: { path: { id } } }),
          );
    },
  });
  if (id && (detail.isPending || detail.isFetching))
    return (
      <ResourceDialog title={t('loading')} onClose={onClose}>
        <LoadingState />
      </ResourceDialog>
    );
  if (id && detail.isError)
    return (
      <ResourceDialog title={t('edit')} onClose={onClose}>
        <ConnectionError retry={() => void detail.refetch()} />
      </ResourceDialog>
    );
  return (
    <SourceForm
      kind={kind}
      userId={userId}
      context={context}
      existing={detail.data?.current ?? null}
      onClose={onClose}
    />
  );
}

function SourceForm({
  kind,
  userId,
  context,
  existing,
  onClose,
}: {
  kind: SourceKind;
  userId: string;
  context: { month: string; today: string };
  existing: IncomeRecord | CommitmentRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(['finance', 'sources']);
  const schema = useMemo(
    () =>
      baseSchema.superRefine((value, issue) => {
        const fail = (path: Array<string | number>, message: string) =>
          issue.addIssue({ code: 'custom', path, message });
        const parse = (field: keyof Values, money: boolean, percent = false) => {
          try {
            if (money) parseMoneyInput(String(value[field]));
            else parseDecimalInput(String(value[field]), percent);
          } catch {
            fail([field], money ? 'invalidMoney' : 'invalidDecimal');
          }
        };
        if (
          value.endsOn &&
          (!z.iso.date().safeParse(value.endsOn).success || value.endsOn < value.startsOn)
        )
          fail(['endsOn'], 'invalidDate');
        if (value.spaceId && !z.uuid().safeParse(value.spaceId).success)
          fail(['spaceId'], 'invalidInput');
        if (kind === 'income') {
          if (value.incomeKind === 'salary') parse('netSalary', true);
          else {
            if (value.incomeMethod === 'fixed') parse('base', true);
            else {
              parse('hourlyRate', false);
              parse('hours', false);
            }
            parse('vatRate', false, true);
            parse('withholdingRate', false, true);
            parse('commissionRate', false, true);
          }
        } else {
          parse('amount', true);
          if (
            value.frequency === 'monthly' &&
            value.dueDay &&
            (!/^\d+$/.test(value.dueDay) || Number(value.dueDay) < 1 || Number(value.dueDay) > 31)
          )
            fail(['dueDay'], 'invalidDay');
          if (value.frequency === 'annual')
            value.installments.forEach((item, index) => {
              if (!/^\d+$/.test(item.month) || Number(item.month) < 1 || Number(item.month) > 12)
                fail(['installments', index, 'month'], 'invalidMonth');
              if (!/^\d+$/.test(item.day) || Number(item.day) < 1 || Number(item.day) > 31)
                fail(['installments', index, 'day'], 'invalidDay');
              try {
                parseMoneyInput(item.amount);
              } catch {
                fail(['installments', index, 'amount'], 'invalidMoney');
              }
            });
        }
      }),
    [kind],
  );
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaults(context, existing),
  });
  const values = useWatch({ control: form.control });
  const installments = useFieldArray({ control: form.control, name: 'installments' });
  const parsed = schema.safeParse(values);
  const request = parsed.success ? requestFrom(parsed.data, kind) : null;
  const signature = request ? JSON.stringify(request) : '';
  const [reviewed, setReviewed] = useState<{ signature: string; result: PreviewResult } | null>(
    null,
  );
  const preview = useMutation({
    mutationFn: async (input: SourceRequest) => {
      const result =
        input.kind === 'income'
          ? requireData(
              await api.POST('/api/v1/income/preview', {
                params: { header: csrfHeaders() },
                body: { input: input.input },
              }),
            )
          : requireData(
              await api.POST('/api/v1/commitments/preview', {
                params: { header: csrfHeaders() },
                body: { input: input.input, month: input.month },
              }),
            );
      return { signature: JSON.stringify(input), result };
    },
    onSuccess: setReviewed,
  });
  const save = useMutation({
    mutationFn: async (input: SourceRequest) => {
      if (reviewed?.signature !== JSON.stringify(input))
        throw new ApiError('INVALID_FINANCIAL_INPUT');
      if (input.kind === 'income') {
        if (!existing)
          return input.recurrence === 'once'
            ? requireData(
                await api.POST('/api/v1/income-entries', {
                  params: { header: csrfHeaders() },
                  body: { input: input.input },
                }),
              )
            : requireData(
                await api.POST('/api/v1/income-sources', {
                  params: { header: csrfHeaders() },
                  body: { input: input.input },
                }),
              );
        const options = {
          params: { path: { id: existing.id }, header: csrfHeaders() },
          body: { input: input.input, expectedVersion: existing.version },
        };
        return input.recurrence === 'once'
          ? requireData(await api.PATCH('/api/v1/income-entries/{id}', options))
          : requireData(await api.POST('/api/v1/income-sources/{id}/revisions', options));
      }
      return existing
        ? requireData(
            await api.POST('/api/v1/commitments/{id}/revisions', {
              params: { path: { id: existing.id }, header: csrfHeaders() },
              body: { input: input.input, expectedVersion: existing.version },
            }),
          )
        : requireData(
            await api.POST('/api/v1/commitments', {
              params: { header: csrfHeaders() },
              body: { input: input.input },
            }),
          );
    },
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({ queryKey: [kind, userId] });
    },
  });
  const numeric = (
    name:
      | 'netSalary'
      | 'base'
      | 'hourlyRate'
      | 'hours'
      | 'vatRate'
      | 'withholdingRate'
      | 'commissionRate'
      | 'amount',
  ) => (
    <Field id={name} label={t(`sources:${name}`)} error={form.formState.errors[name]?.message}>
      <Input
        id={name}
        inputMode="decimal"
        maxLength={32}
        aria-invalid={Boolean(form.formState.errors[name])}
        aria-describedby={form.formState.errors[name] ? `${name}-error` : undefined}
        {...form.register(name)}
      />
    </Field>
  );
  const ready = reviewed !== null && reviewed.signature === signature;
  const managedKind = existing && 'managedKind' in existing ? existing.managedKind : null;
  const readOnly =
    existing !== null &&
    existing.archivedFromMonth !== null &&
    (context.month >= existing.archivedFromMonth ||
      existing.revision.input.effectiveFromMonth >= existing.archivedFromMonth);
  return (
    <ResourceDialog
      title={t(
        existing
          ? 'sources:editTitle'
          : kind === 'income'
            ? 'sources:createIncome'
            : 'sources:createCommitment',
      )}
      onClose={onClose}
      busy={save.isPending}
      wide
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((input) => save.mutate(requestFrom(input, kind)))}
      >
        <fieldset disabled={save.isPending || readOnly}>
          <div className="source-form-grid">
            <div className="source-fields">
              <p className="form-intro">
                {t(existing ? 'sources:revisionHint' : 'sources:manualEntryHint')}
              </p>
              <Field
                id="source-name"
                label={t('sources:name')}
                error={form.formState.errors.name?.message}
              >
                <Input
                  id="source-name"
                  required
                  maxLength={120}
                  aria-invalid={Boolean(form.formState.errors.name)}
                  aria-describedby={form.formState.errors.name ? 'source-name-error' : undefined}
                  {...form.register('name')}
                />
              </Field>
              {kind === 'income' ? (
                <>
                  <div className="field-grid">
                    <Field id="income-kind" label={t('sources:kind')}>
                      <select
                        id="income-kind"
                        className="form-input"
                        {...form.register('incomeKind')}
                      >
                        <option value="salary">{t('sources:kinds.salary')}</option>
                        <option value="professional">
                          {t('sources:kinds.professionalIncome')}
                        </option>
                      </select>
                    </Field>
                    <fieldset disabled={existing !== null}>
                      <Field id="recurrence" label={t('sources:recurrence')}>
                        <select
                          id="recurrence"
                          className="form-input"
                          {...form.register('recurrence')}
                        >
                          <option value="monthly">{t('sources:monthly')}</option>
                          <option value="once">{t('sources:once')}</option>
                        </select>
                      </Field>
                    </fieldset>
                  </div>
                  {values.incomeKind === 'salary' ? (
                    numeric('netSalary')
                  ) : (
                    <>
                      <Field id="income-method" label={t('sources:incomeMethod')}>
                        <select
                          id="income-method"
                          className="form-input"
                          {...form.register('incomeMethod')}
                        >
                          <option value="fixed">{t('sources:fixedBase')}</option>
                          <option value="hourly">{t('sources:hourlyBase')}</option>
                        </select>
                      </Field>
                      {values.incomeMethod === 'fixed' ? (
                        numeric('base')
                      ) : (
                        <div className="field-grid">
                          {numeric('hourlyRate')}
                          {numeric('hours')}
                        </div>
                      )}
                      <div className="field-grid">
                        {numeric('vatRate')}
                        {numeric('withholdingRate')}
                        {numeric('commissionRate')}
                      </div>
                      <p className="field-hint">{t('sources:taxHint')}</p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="field-grid">
                    <fieldset disabled={managedKind !== null}>
                      <Field id="commitment-kind" label={t('sources:kind')}>
                        <select
                          id="commitment-kind"
                          className="form-input"
                          {...form.register('commitmentKind')}
                        >
                          {(
                            [
                              'fixed',
                              'subscription',
                              'professional',
                              'shared',
                              'financing',
                              'investment',
                            ] as const
                          ).map((value) => (
                            <option key={value} value={value}>
                              {t(`sources:kinds.${value}`)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </fieldset>
                    <fieldset disabled={managedKind === 'financing'}>
                      <Field id="frequency" label={t('sources:frequency')}>
                        <select
                          id="frequency"
                          className="form-input"
                          {...form.register('frequency')}
                        >
                          <option value="monthly">{t('sources:monthly')}</option>
                          <option value="annual">{t('sources:annual')}</option>
                        </select>
                      </Field>
                    </fieldset>
                  </div>
                  {numeric('amount')}
                  {values.frequency === 'monthly' && (
                    <Field
                      id="due-day"
                      label={t('sources:dueDay')}
                      hint={t('sources:optionalDueDay')}
                      error={form.formState.errors.dueDay?.message}
                    >
                      <Input
                        id="due-day"
                        inputMode="numeric"
                        maxLength={2}
                        {...form.register('dueDay')}
                      />
                    </Field>
                  )}
                </>
              )}
              <h3 className="form-section-heading">{t('sources:validity')}</h3>
              <div className="field-grid">
                <Field
                  id="effective-month"
                  label={t('effectiveMonth')}
                  error={form.formState.errors.effectiveFromMonth?.message}
                >
                  <Input
                    id="effective-month"
                    type="month"
                    required
                    readOnly={
                      existing !== null && kind === 'income' && values.recurrence === 'once'
                    }
                    {...form.register('effectiveFromMonth')}
                  />
                </Field>
                <Field
                  id="starts-on"
                  label={t('sources:startsOn')}
                  error={form.formState.errors.startsOn?.message}
                >
                  <Input id="starts-on" type="date" required {...form.register('startsOn')} />
                </Field>
                <Field
                  id="ends-on"
                  label={t('sources:endsOn')}
                  error={form.formState.errors.endsOn?.message}
                >
                  <Input id="ends-on" type="date" {...form.register('endsOn')} />
                </Field>
              </div>
              <h3 className="form-section-heading">{t('sources:destination')}</h3>
              <DestinationPicker
                userId={userId}
                accountId={values.accountId ?? ''}
                spaceId={values.spaceId ?? ''}
                error={form.formState.errors.accountId?.message}
                onAccount={(value) => form.setValue('accountId', value, { shouldValidate: true })}
                onSpace={(value) => form.setValue('spaceId', value)}
              />
              {kind === 'commitments' && values.frequency === 'annual' && (
                <section>
                  <h3 className="form-section-heading">{t('sources:installments')}</h3>
                  <p className="field-hint">{t('sources:installmentHint')}</p>
                  {installments.fields.map((item, index) => (
                    <div className="installment-row" key={item.id}>
                      <Field
                        id={`installment-month-${index}`}
                        label={t('sources:monthNumber')}
                        error={form.formState.errors.installments?.[index]?.month?.message}
                      >
                        <Input
                          id={`installment-month-${index}`}
                          inputMode="numeric"
                          maxLength={2}
                          {...form.register(`installments.${index}.month`)}
                        />
                      </Field>
                      <Field
                        id={`installment-day-${index}`}
                        label={t('sources:day')}
                        error={form.formState.errors.installments?.[index]?.day?.message}
                      >
                        <Input
                          id={`installment-day-${index}`}
                          inputMode="numeric"
                          maxLength={2}
                          {...form.register(`installments.${index}.day`)}
                        />
                      </Field>
                      <Field
                        id={`installment-amount-${index}`}
                        label={t('sources:amount')}
                        error={form.formState.errors.installments?.[index]?.amount?.message}
                      >
                        <Input
                          id={`installment-amount-${index}`}
                          inputMode="decimal"
                          maxLength={32}
                          {...form.register(`installments.${index}.amount`)}
                        />
                      </Field>
                      <Button
                        variant="outline"
                        onClick={() => installments.remove(index)}
                        aria-label={t('sources:removeInstallment', { index: index + 1 })}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    disabled={installments.fields.length >= 24}
                    onClick={() => installments.append({ month: '', day: '', amount: '0,00' })}
                  >
                    {t('sources:addInstallment')}
                  </Button>
                </section>
              )}
            </div>
            <aside className="source-preview">
              <p className="eyebrow">{t('sources:serverPreview')}</p>
              {kind === 'commitments' && (
                <Field
                  id="preview-month"
                  label={t('sources:previewMonth')}
                  error={form.formState.errors.previewMonth?.message}
                >
                  <Input id="preview-month" type="month" {...form.register('previewMonth')} />
                </Field>
              )}
              <Button
                variant="outline"
                disabled={preview.isPending}
                onClick={() => {
                  void form.handleSubmit((input) => preview.mutate(requestFrom(input, kind)))();
                }}
              >
                {t(preview.isPending ? 'sources:calculating' : 'sources:calculate')}
              </Button>
              {preview.isError && <FinanceError error={preview.error} />}
              {reviewed && !ready && (
                <p className="preview-stale" role="status">
                  {t('sources:previewStale')}
                </p>
              )}
              {ready && reviewed && <PreviewSummary result={reviewed.result} />}
              <p className="field-hint preview-explanation">{t('sources:previewHint')}</p>
            </aside>
          </div>
          {save.isError && (
            <>
              <FinanceError error={save.error} />
              <p className="field-hint">{t('sources:conflictHint')}</p>
            </>
          )}
        </fieldset>
        {readOnly && <p className="record-status">{t('sources:readOnly')}</p>}
        <div className="dialog-actions">
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={readOnly || !ready || save.isPending || preview.isPending}
          >
            {t(save.isPending ? 'saving' : 'save')}
          </Button>
        </div>
      </form>
      {existing && <RevisionHistory kind={kind} id={existing.id} userId={userId} />}
    </ResourceDialog>
  );
}

function PreviewSummary({ result }: { result: PreviewResult }) {
  const { t, i18n } = useTranslation('sources');
  if ('expectedCash' in result)
    return (
      <dl className="preview-values">
        {(
          [
            'base',
            'vat',
            'withholding',
            'commission',
            'expectedCash',
            'taxReserve',
            'spendableIncome',
          ] as const
        ).map((key) => (
          <div key={key}>
            <dt>{t(`calculation.${key}`)}</dt>
            <dd>{formatMoney(result[key], i18n.resolvedLanguage)}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <>
      <h3 className="preview-value">{formatMoney(result.monthlyCharge, i18n.resolvedLanguage)}</h3>
      <p className="field-hint">{t(result.active ? 'monthlyImpact' : 'notActive')}</p>
      <h4>{t('duePayments')}</h4>
      <ul className="due-payments">
        {result.duePayments.map((payment, index) => (
          <li key={`${payment.date}-${index}`}>
            <span>
              {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                dateStyle: 'medium',
                timeZone: 'UTC',
              }).format(new Date(`${payment.date}T00:00:00Z`))}
            </span>
            <strong>{formatMoney(payment.amount, i18n.resolvedLanguage)}</strong>
          </li>
        ))}
      </ul>
      <p className="field-hint">{t('noDuplicateCharge')}</p>
    </>
  );
}

function RevisionHistory({ kind, id, userId }: { kind: SourceKind; id: string; userId: string }) {
  const { t } = useTranslation('sources');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: [`${kind}-history`, userId, id, page],
    enabled: open,
    queryFn: async ({ signal }) =>
      kind === 'income'
        ? requireData(
            await api.GET('/api/v1/income-sources/{id}', {
              signal,
              params: { path: { id }, query: { page, pageSize: 10 } },
            }),
          )
        : requireData(
            await api.GET('/api/v1/commitments/{id}', {
              signal,
              params: { path: { id }, query: { page, pageSize: 10 } },
            }),
          ),
  });
  return (
    <details className="revision-history" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('history')}</summary>
      {history.isPending ? (
        <LoadingState />
      ) : history.isError ? (
        <FinanceError error={history.error} />
      ) : (
        <>
          <ul>
            {history.data.history.map((revision) => (
              <li key={revision.id}>
                <strong>{t('revision', { version: revision.version })}</strong>
                <span>{revision.input.name}</span>
                <span>{revision.input.effectiveFromMonth}</span>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={history.data.pageSize}
            total={history.data.total}
            onChange={setPage}
          />
        </>
      )}
    </details>
  );
}
