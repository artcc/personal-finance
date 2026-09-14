import { useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router-dom';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Field, FinanceError, ResourceDialog } from '../finance/shared';
import { DestinationPicker } from '../finance/destination-picker';
import { formatMoney, moneyInput, parseMoneyInput } from '../finance/presentation';
import { acceptPlan } from './planning-api';
import type { MonthlyPlan } from './planning-api';
import { PlanLifecycleDialog } from './planning-dialogs';

const purposeSchema = z.enum(['commitment', 'tax_reserve', 'everyday', 'remaining']);
const rowSchema = z.object({
  allocationId: z.string(),
  accountId: z.uuid({ error: 'accountRequired' }),
  spaceId: z.string(),
  destinationLabel: z.string(),
  purpose: purposeSchema,
  sourceLineId: z.string(),
  amount: z.string(),
  remainder: z.boolean(),
});
const schema = z.object({ rows: z.array(rowSchema).max(500) }).superRefine((values, context) => {
  if (values.rows.filter((row) => row.remainder).length > 1)
    context.addIssue({ code: 'custom', path: ['rows'], message: 'invalidInput' });
  values.rows.forEach((row, index) => {
    if (!row.remainder)
      try {
        parseMoneyInput(row.amount);
      } catch {
        context.addIssue({
          code: 'custom',
          path: ['rows', index, 'amount'],
          message: 'invalidMoney',
        });
      }
    if (row.spaceId && !z.uuid().safeParse(row.spaceId).success)
      context.addIssue({
        code: 'custom',
        path: ['rows', index, 'accountId'],
        message: 'accountRequired',
      });
    if (['commitment', 'tax_reserve'].includes(row.purpose) && !row.sourceLineId)
      context.addIssue({
        code: 'custom',
        path: ['rows', index, 'sourceLineId'],
        message: 'required',
      });
  });
});

export function AllocationEditor({ plan, userId }: { plan: MonthlyPlan; userId: string }) {
  const { t, i18n } = useTranslation(['planning', 'finance']);
  const [reset, setReset] = useState(false);
  const [destinationRow, setDestinationRow] = useState<number | null>(null);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      rows: plan.allocations.map((row) => ({
        allocationId: row.id,
        accountId: row.destination.accountId,
        spaceId: row.destination.spaceId ?? '',
        destinationLabel: [row.destination.accountName, row.destination.spaceName]
          .filter(Boolean)
          .join(' / '),
        purpose: row.purpose,
        sourceLineId: row.sourceLineId ?? '',
        amount: moneyInput(row.amount),
        remainder: row.remainder,
      })),
    },
  });
  const rows = useFieldArray({ control: form.control, name: 'rows' });
  const watched = useWatch({ control: form.control, name: 'rows' });
  const save = useMutation({
    mutationFn: async (values: z.output<typeof schema>) =>
      requireData(
        await api.PUT('/api/v1/monthly-plans/{id}/allocations', {
          params: { path: { id: plan.id }, header: csrfHeaders() },
          body: {
            expectedVersion: plan.version,
            allocations: values.rows.map((row) => ({
              id: row.allocationId,
              destination: { accountId: row.accountId, spaceId: row.spaceId || null },
              purpose: row.purpose,
              sourceLineId: ['commitment', 'tax_reserve'].includes(row.purpose)
                ? row.sourceLineId
                : null,
              amount: parseMoneyInput(row.remainder ? '0' : row.amount),
              remainder: row.remainder,
            })),
          },
        }),
      ),
    onSuccess: (data) => acceptPlan(userId, data),
  });
  const firstDestination = plan.incomes[0]?.destination ?? plan.charges[0]?.destination;
  const blocker = useBlocker(
    ({ nextLocation }) =>
      form.formState.isDirty && !save.isPending && nextLocation.pathname !== '/login',
  );
  const readOnly = plan.state === 'closed';
  if (readOnly) return <AllocationGroups plan={plan} />;
  return (
    <>
      <section className="planning-panel">
        <div className="section-heading">
          <div>
            <h2>{t('allocationTitle')}</h2>
            <p>{t('allocationHint')}</p>
          </div>
          <Button variant="outline" disabled={save.isPending} onClick={() => setReset(true)}>
            {t('suggestAction')}
          </Button>
        </div>
        <div className="allocation-cash-summary">
          <span>
            {t('expectedCash')}
            <strong>{formatMoney(plan.summary.expectedCash, i18n.resolvedLanguage)}</strong>
          </span>
          <span>
            {t('unallocated')}
            <strong>{formatMoney(plan.summary.unallocatedCash, i18n.resolvedLanguage)}</strong>
          </span>
        </div>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} noValidate>
          <fieldset disabled={save.isPending}>
            {rows.fields.map((field, index) => {
              const current = watched[index] ?? field;
              const purpose = current.purpose ?? field.purpose;
              const lines = purpose === 'tax_reserve' ? plan.incomes : plan.charges;
              return (
                <div className="allocation-edit-row" key={field.id}>
                  <Field id={`purpose-${index}`} label={t('purpose')}>
                    <select
                      id={`purpose-${index}`}
                      className="form-input"
                      value={purpose}
                      onChange={(event) => {
                        const next = purposeSchema.parse(event.target.value);
                        form.setValue(`rows.${index}.purpose`, next, { shouldDirty: true });
                        form.setValue(`rows.${index}.sourceLineId`, '');
                        if (next !== 'remaining') form.setValue(`rows.${index}.remainder`, false);
                      }}
                    >
                      <option value="commitment">{t('purposes.commitment')}</option>
                      <option value="tax_reserve">{t('purposes.tax_reserve')}</option>
                      <option value="everyday">{t('purposes.everyday')}</option>
                      <option value="remaining">{t('purposes.remaining')}</option>
                    </select>
                  </Field>
                  {['commitment', 'tax_reserve'].includes(purpose) && (
                    <Field
                      id={`funding-source-${index}`}
                      label={t('fundingSource')}
                      error={form.formState.errors.rows?.[index]?.sourceLineId?.message}
                    >
                      <select
                        id={`funding-source-${index}`}
                        className="form-input"
                        {...form.register(`rows.${index}.sourceLineId`)}
                      >
                        <option value="">{t('chooseSource')}</option>
                        {lines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <div className="allocation-destination">
                    <span className="field-hint">{t('destination')}</span>
                    <Button variant="outline" onClick={() => setDestinationRow(index)}>
                      {current.destinationLabel || t('chooseDestination')}
                    </Button>
                    {form.formState.errors.rows?.[index]?.accountId && (
                      <p className="field-error">{t('finance:validation.accountRequired')}</p>
                    )}
                  </div>
                  <Field
                    id={`allocation-amount-${index}`}
                    label={t('amount')}
                    error={form.formState.errors.rows?.[index]?.amount?.message}
                  >
                    <Input
                      id={`allocation-amount-${index}`}
                      inputMode="decimal"
                      maxLength={32}
                      readOnly={current.remainder}
                      {...form.register(`rows.${index}.amount`)}
                    />
                  </Field>
                  {purpose === 'remaining' && (
                    <label className="checkbox-field">
                      <input type="checkbox" {...form.register(`rows.${index}.remainder`)} />
                      {t('automaticRemainder')}
                    </label>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => rows.remove(index)}
                    aria-label={t('removeAllocation', { index: index + 1 })}
                  >
                    ×
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              disabled={rows.fields.length >= 500}
              onClick={() =>
                rows.append({
                  allocationId: crypto.randomUUID(),
                  accountId: firstDestination?.accountId ?? '',
                  spaceId: firstDestination?.spaceId ?? '',
                  destinationLabel: firstDestination
                    ? [firstDestination.accountName, firstDestination.spaceName]
                        .filter(Boolean)
                        .join(' / ')
                    : '',
                  purpose: 'everyday',
                  sourceLineId: '',
                  amount: '0,00',
                  remainder: false,
                })
              }
            >
              {t('addAllocation')}
            </Button>
            {save.isError && <FinanceError error={save.error} />}
            {form.formState.errors.rows?.root && <p className="field-error">{t('oneRemainder')}</p>}
            <div className="allocation-save-row">
              <p className="field-hint" role="status">
                {t(form.formState.isDirty ? 'unsavedAllocation' : 'savedAllocation')}
              </p>
              <Button type="submit" disabled={save.isPending}>
                {t(save.isPending ? 'finance:saving' : 'saveAllocation')}
              </Button>
              {form.formState.isDirty && (
                <Button variant="outline" onClick={() => form.reset()}>
                  {t('discardEdits')}
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      </section>
      <AllocationGroups plan={plan} />
      {blocker.state === 'blocked' && (
        <ResourceDialog title={t('unsavedTitle')} onClose={() => blocker.reset()}>
          <p className="form-intro">{t('unsavedHint')}</p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => blocker.reset()}>
              {t('keepEditing')}
            </Button>
            <Button onClick={() => blocker.proceed()}>{t('discardAndLeave')}</Button>
          </div>
        </ResourceDialog>
      )}
      {reset && (
        <PlanLifecycleDialog
          mode="suggest"
          plan={plan}
          userId={userId}
          onClose={() => setReset(false)}
        />
      )}
      {destinationRow !== null && (
        <AllocationDestination
          userId={userId}
          initial={form.getValues(`rows.${destinationRow}`)}
          onClose={() => setDestinationRow(null)}
          onApply={(accountId, spaceId, label) => {
            form.setValue(`rows.${destinationRow}.accountId`, accountId, { shouldDirty: true });
            form.setValue(`rows.${destinationRow}.spaceId`, spaceId, { shouldDirty: true });
            form.setValue(`rows.${destinationRow}.destinationLabel`, label, { shouldDirty: true });
            setDestinationRow(null);
          }}
        />
      )}
    </>
  );
}

function AllocationDestination({
  userId,
  initial,
  onClose,
  onApply,
}: {
  userId: string;
  initial: z.output<typeof rowSchema>;
  onClose: () => void;
  onApply: (accountId: string, spaceId: string, label: string) => void;
}) {
  const { t } = useTranslation(['planning', 'finance']);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [spaceId, setSpaceId] = useState(initial.spaceId);
  const [label, setLabel] = useState(initial.destinationLabel);
  return (
    <ResourceDialog title={t('chooseDestination')} onClose={onClose}>
      <DestinationPicker
        userId={userId}
        accountId={accountId}
        spaceId={spaceId}
        onAccount={setAccountId}
        onSpace={setSpaceId}
        onLabel={setLabel}
      />
      <div className="dialog-actions">
        <Button variant="outline" onClick={onClose}>
          {t('finance:cancel')}
        </Button>
        <Button disabled={!accountId} onClick={() => onApply(accountId, spaceId, label)}>
          {t('useDestination')}
        </Button>
      </div>
    </ResourceDialog>
  );
}

export function AllocationGroups({ plan }: { plan: MonthlyPlan }) {
  const { t, i18n } = useTranslation('planning');
  return (
    <section className="planning-panel">
      <h2>{t('accountDistribution')}</h2>
      <p className="field-hint">{t('distributionHint')}</p>
      {plan.groups.length === 0 && <p className="chart-empty-copy">{t('noAllocations')}</p>}
      {plan.groups.map((group) => (
        <section className="allocation-group" key={group.accountId}>
          <div className="section-heading">
            <h3>{group.accountName}</h3>
            <strong>{formatMoney(group.total, i18n.resolvedLanguage)}</strong>
          </div>
          <p className="field-hint">
            {t('directAmount', { amount: formatMoney(group.directAmount, i18n.resolvedLanguage) })}
          </p>
          <ul>
            {group.allocations.map((row) => (
              <li key={row.id}>
                <div>
                  <span>{row.destination.spaceName ?? t('directAccount')}</span>
                  <small>
                    {row.label || t(`purposes.${row.purpose}`)}
                    {row.remainder ? ` · ${t('automaticRemainder')}` : ''}
                  </small>
                </div>
                <strong>{formatMoney(row.amount, i18n.resolvedLanguage)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
