import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, NavLink, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import type { Session } from '../auth/session';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { Field, FinanceError, Pagination } from '../finance/shared';
import { useFinancialContext } from '../finance/use-financial-context';
import { formatMoney } from '../finance/presentation';
import { acceptPlan, monthLabel, monthPattern, useMonthlyPlan } from './planning-api';
import type { MonthlyPlan, PlanIncome, PlanCharge } from './planning-api';
import { PlanningCharts } from './planning-charts';
import { AllocationEditor, AllocationGroups } from './allocation-editor';
import { PlanLifecycleDialog, PlanOverrideDialog, PlanRefreshDialog } from './planning-dialogs';

export function PlanningPage({
  view = 'overview',
}: {
  view?: 'overview' | 'allocation' | 'history';
}) {
  const { t, i18n } = useTranslation(['planning', 'finance']);
  const session = useOutletContext<Session>();
  const context = useFinancialContext(session.user.id);
  const params = useParams<{ month: string }>();
  const month = params.month ?? context.data?.month ?? '';
  const navigate = useNavigate();
  const result = useMonthlyPlan(session.user.id, month);
  const [lifecycle, setLifecycle] = useState<'close' | 'reopen' | null>(null);
  const [refresh, setRefresh] = useState(false);
  const create = useMutation({
    mutationFn: async () =>
      requireData(
        await api.POST('/api/v1/monthly-plans', {
          params: { header: csrfHeaders() },
          body: { month },
        }),
      ),
    onSuccess: (data) => acceptPlan(session.user.id, data),
  });
  if (!month && context.isPending) return <LoadingState />;
  if (!month && context.isError) return <ConnectionError retry={() => void context.refetch()} />;
  if (!monthPattern.test(month))
    return (
      <section className="data-empty">
        <h1>{t('invalidMonth')}</h1>
        <Button asChild>
          <Link to="/">{t('currentMonth')}</Link>
        </Button>
      </section>
    );
  const plan = result.data;
  const path = `/planning/${month}`;
  return (
    <>
      <header className="financial-page-heading">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>
            {t(
              view === 'allocation'
                ? 'allocationTitle'
                : view === 'history'
                  ? 'historyTitle'
                  : 'title',
            )}
          </h1>
          <p>
            {monthLabel(month, i18n.resolvedLanguage)} {plan ? `· ${t(plan.state)}` : ''}
          </p>
        </div>
        <div className="plan-header-actions">
          <Field id="planning-month" label={t('month')}>
            <Input
              id="planning-month"
              type="month"
              min="1900-01"
              max="9999-12"
              value={month}
              onChange={(event) => {
                if (monthPattern.test(event.target.value)) {
                  setLifecycle(null);
                  setRefresh(false);
                  navigate(
                    `/planning/${event.target.value}${view === 'overview' ? '' : `/${view}`}`,
                  );
                }
              }}
            />
          </Field>
          {plan &&
          view === 'overview' &&
          plan.state === 'draft' &&
          BigInt(plan.summary.unallocatedCash.minorUnits) !== 0n ? (
            <Button asChild>
              <Link to={`${path}/allocation`}>{t('reviewAllocation')}</Link>
            </Button>
          ) : (
            plan &&
            view === 'overview' && (
              <Button onClick={() => setLifecycle(plan.state === 'closed' ? 'reopen' : 'close')}>
                {t(plan.state === 'closed' ? 'reopenAction' : 'closeAction')}
              </Button>
            )
          )}
        </div>
      </header>
      <nav className="planning-tabs" aria-label={t('navigation')}>
        <NavLink to={path} end className={view === 'overview' ? 'active' : ''}>
          {t('overviewTab')}
        </NavLink>
        <NavLink to={`${path}/allocation`}>{t('allocationTab')}</NavLink>
        <NavLink to={`${path}/history`}>{t('historyTab')}</NavLink>
      </nav>
      {result.isPending ? (
        <LoadingState />
      ) : result.isError && !plan ? (
        <ConnectionError retry={() => void result.refetch()} />
      ) : !plan ? (
        <section className="data-empty">
          <h2>{t('emptyTitle')}</h2>
          <p>{t('emptyHint')}</p>
          {create.isError && <FinanceError error={create.error} />}
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {t(create.isPending ? 'preparing' : 'prepare')}
          </Button>
          <div className="setup-links">
            <Link to="/accounts">{t('setupAccounts')}</Link>
            <Link to="/income">{t('setupIncome')}</Link>
            <Link to="/commitments">{t('setupCommitments')}</Link>
          </div>
        </section>
      ) : (
        <>
          {result.isError && (
            <p className="feedback-banner" role="status">
              {t('staleView')}
            </p>
          )}
          {plan.state === 'closed' && (
            <p className="closed-plan-notice">{t('closedNotice', { revision: plan.revision })}</p>
          )}
          {view === 'overview' ? (
            <>
              <PlanSummaryView plan={plan} />
              <div className="plan-toolbar">
                <p>{t('savedSnapshotHint')}</p>
                {plan.state === 'draft' && (
                  <Button variant="outline" onClick={() => setRefresh(true)}>
                    {t('refreshAction')}
                  </Button>
                )}
              </div>
              <PlanningCharts plan={plan} userId={session.user.id} />
              <div className="plan-overview-columns">
                <PlanLines key={plan.id} plan={plan} userId={session.user.id} />
                <section className="planning-panel">
                  <h2>{t('allocationStatus')}</h2>
                  <dl className="preview-values">
                    <div>
                      <dt>{t('unallocated')}</dt>
                      <dd>{formatMoney(plan.summary.unallocatedCash, i18n.resolvedLanguage)}</dd>
                    </div>
                    <div>
                      <dt>{t('everyday')}</dt>
                      <dd>{formatMoney(plan.summary.everydayAllocation, i18n.resolvedLanguage)}</dd>
                    </div>
                    <div>
                      <dt>{t('remainingAvailability')}</dt>
                      <dd>
                        {formatMoney(plan.summary.remainingAvailability, i18n.resolvedLanguage)}
                      </dd>
                    </div>
                  </dl>
                  <p className="field-hint">{t('everydayHint')}</p>
                  <Button asChild>
                    <Link to={`${path}/allocation`}>{t('reviewAllocation')}</Link>
                  </Button>
                </section>
              </div>
            </>
          ) : view === 'allocation' ? (
            <AllocationEditor
              key={`${plan.id}-${plan.version}`}
              plan={plan}
              userId={session.user.id}
            />
          ) : (
            <PlanHistory key={plan.id} plan={plan} userId={session.user.id} />
          )}
          {lifecycle && (
            <PlanLifecycleDialog
              plan={plan}
              userId={session.user.id}
              mode={lifecycle}
              onClose={() => setLifecycle(null)}
            />
          )}
          {refresh && (
            <PlanRefreshDialog
              plan={plan}
              userId={session.user.id}
              onClose={() => setRefresh(false)}
            />
          )}
        </>
      )}
    </>
  );
}

function PlanSummaryView({ plan }: { plan: MonthlyPlan }) {
  const { t, i18n } = useTranslation('planning');
  const negative = BigInt(plan.summary.plannedAvailability.minorUnits) < 0n;
  return (
    <>
      <section
        className={`plan-hero${negative ? ' plan-hero--negative' : ''}`}
        aria-labelledby="availability-title"
      >
        <div>
          <h2 id="availability-title">{t(negative ? 'shortfall' : 'availability')}</h2>
          <p className="plan-hero-amount">
            {formatMoney(plan.summary.plannedAvailability, i18n.resolvedLanguage)}
          </p>
          <p>{t('availabilityHint')}</p>
        </div>
        <span className="stage-badge">{t('revisionLabel', { revision: plan.revision })}</span>
      </section>
      <div className="plan-metrics">
        {[
          { label: 'spendableIncome', value: plan.summary.spendableIncome },
          { label: 'costs', value: plan.summary.monthlyCosts },
          { label: 'provisions', value: plan.summary.annualProvisions },
          { label: 'investment', value: plan.summary.plannedInvestment },
        ].map((item) => (
          <section key={item.label}>
            <h3>{t(item.label)}</h3>
            <strong>{formatMoney(item.value, i18n.resolvedLanguage)}</strong>
          </section>
        ))}
      </div>
      {BigInt(plan.summary.fundingGap.minorUnits) > 0n && (
        <p className="funding-notice">
          {t('fundingGapNotice', {
            amount: formatMoney(plan.summary.fundingGap, i18n.resolvedLanguage),
          })}
        </p>
      )}
    </>
  );
}

function PlanLines({
  plan,
  userId,
  readOnly = false,
}: {
  plan: MonthlyPlan;
  userId: string;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation('planning');
  const [editing, setEditing] = useState<PlanIncome | PlanCharge | null>(null);
  const payments = plan.charges
    .flatMap((line) => line.duePayments.map((payment) => ({ ...payment, name: line.name })))
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      <section className="planning-panel">
        <h2>{t('incomeBreakdown')}</h2>
        {plan.incomes.length === 0 && <p className="field-hint">{t('noIncome')}</p>}
        {plan.incomes.map((line) => (
          <div className="plan-source-line" key={line.id}>
            <div>
              <h3>{line.name}</h3>
              <p>{t('sourceRevision', { version: line.sourceVersion })}</p>
              <p>
                {t('receiptAndReserve', {
                  cash: formatMoney(line.expectedCash, i18n.resolvedLanguage),
                  reserve: formatMoney(line.taxReserve, i18n.resolvedLanguage),
                })}
              </p>
              {line.overrideReason && (
                <p className="override-note">{t('adjusted', { reason: line.overrideReason })}</p>
              )}
            </div>
            <div>
              <strong>{formatMoney(line.spendableIncome, i18n.resolvedLanguage)}</strong>
              {!readOnly && plan.state === 'draft' && (
                <Button
                  variant="outline"
                  onClick={() => setEditing(line)}
                  aria-label={t('adjustLine', { name: line.name })}
                >
                  {t('adjust')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="planning-panel">
        <h2>{t('chargeBreakdown')}</h2>
        {plan.charges.length === 0 && <p className="field-hint">{t('noCharges')}</p>}
        {plan.charges.map((line) => (
          <div className="plan-source-line" key={line.id}>
            <div>
              <h3>{line.name}</h3>
              <p>
                {t(`buckets.${line.bucket}`)} · {line.destination.accountName}
                {line.destination.spaceName ? ` / ${line.destination.spaceName}` : ''}
              </p>
              {line.overrideReason && (
                <p className="override-note">{t('adjusted', { reason: line.overrideReason })}</p>
              )}
            </div>
            <div>
              <strong>{formatMoney(line.amount, i18n.resolvedLanguage)}</strong>
              {!readOnly && plan.state === 'draft' && (
                <Button
                  variant="outline"
                  onClick={() => setEditing(line)}
                  aria-label={t('adjustLine', { name: line.name })}
                >
                  {t('adjust')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="planning-panel">
        <h2>{t('duePayments')}</h2>
        <p className="field-hint">{t('dueHint')}</p>
        <ul className="due-payments">
          {payments.map((payment, index) => (
            <li key={`${payment.date}-${index}`}>
              <span>
                {payment.name} ·{' '}
                {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                  dateStyle: 'medium',
                  timeZone: 'UTC',
                }).format(new Date(`${payment.date}T00:00:00Z`))}
              </span>
              <strong>{formatMoney(payment.amount, i18n.resolvedLanguage)}</strong>
            </li>
          ))}
        </ul>
        {payments.length === 0 && <p className="field-hint">{t('noPayments')}</p>}
      </section>
      {editing && (
        <PlanOverrideDialog
          plan={plan}
          line={editing}
          userId={userId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PlanHistory({ plan, userId }: { plan: MonthlyPlan; userId: string }) {
  const { t, i18n } = useTranslation('planning');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const history = useQuery({
    queryKey: ['plan-history', userId, plan.id, page],
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/monthly-plans/{id}/revisions', {
          signal,
          params: { path: { id: plan.id }, query: { page } },
        }),
      ),
  });
  const snapshot = useQuery({
    queryKey: ['plan-revision', userId, plan.id, selected, plan.version],
    enabled: selected !== null,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/monthly-plans/{id}/revisions/{revision}', {
          signal,
          params: { path: { id: plan.id, revision: String(selected) } },
        }),
      ),
  });
  return (
    <>
      <section className="planning-panel">
        <h2>{t('historyTitle')}</h2>
        <p className="field-hint">{t('historyHint')}</p>
        {history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ConnectionError retry={() => void history.refetch()} />
        ) : (
          <>
            <ul className="plan-history-list">
              {history.data.items.map((item) => (
                <li key={item.revision}>
                  <div>
                    <strong>
                      {t('revisionLabel', { revision: item.revision })} · {t(item.state)}
                    </strong>
                    {item.reopenReason && <p>{item.reopenReason}</p>}
                  </div>
                  <span>{formatMoney(item.availability, i18n.resolvedLanguage)}</span>
                  <Button variant="outline" onClick={() => setSelected(item.revision)}>
                    {t('viewRevision')}
                  </Button>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={20} total={history.data.total} onChange={setPage} />
          </>
        )}
      </section>
      {selected !== null &&
        (snapshot.isPending ? (
          <LoadingState />
        ) : snapshot.isError ? (
          <ConnectionError retry={() => void snapshot.refetch()} />
        ) : (
          snapshot.data && (
            <section className="historical-plan">
              <h2>{t('historicalRevision', { revision: selected })}</h2>
              <PlanSummaryView plan={snapshot.data} />
              <PlanLines plan={snapshot.data} userId={userId} readOnly />
              <AllocationGroups plan={snapshot.data} />
            </section>
          )
        ))}
    </>
  );
}
