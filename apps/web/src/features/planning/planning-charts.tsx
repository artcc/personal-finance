import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { formatMoney } from '../finance/presentation';
import type { Money } from '../finance/presentation';
import { monthLabel } from './planning-api';
import type { MonthlyPlan, PlanTrend } from './planning-api';

// Geometry only: exact API amounts remain the labels and the financial source of truth.
function ratio(amount: bigint, total: bigint, scale = 1000): number {
  return total > 0n ? Number((amount * BigInt(scale)) / total) : 0;
}
function ordinal(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5));
}

export function PlanningCharts({ plan, userId }: { plan: MonthlyPlan; userId: string }) {
  const { t } = useTranslation('planning');
  const trend = useQuery({
    queryKey: ['plan-trend', userId, plan.month],
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/api/v1/monthly-plans/trend', {
          signal,
          params: { query: { month: plan.month } },
        }),
      ),
  });
  return (
    <div className="planning-chart-grid">
      <section className="planning-panel">
        <h2>{t('trendTitle')}</h2>
        <p className="field-hint">{t('trendHint')}</p>
        {trend.isError ? (
          <p className="field-hint">{t('chartUnavailable')}</p>
        ) : !trend.data || trend.data.length < 2 ? (
          <p className="chart-empty-copy">{t(trend.isPending ? 'chartLoading' : 'noHistory')}</p>
        ) : (
          <AvailabilityTrend points={trend.data} />
        )}
      </section>
      <BudgetChart summary={plan.summary} />
    </div>
  );
}

function AvailabilityTrend({ points }: { points: PlanTrend[] }) {
  const { t, i18n } = useTranslation('planning');
  const amounts = points.map((point) => BigInt(point.availability.minorUnits));
  const min = amounts.reduce((lowest, amount) => (amount < lowest ? amount : lowest), 0n);
  const max = amounts.reduce((highest, amount) => (amount > highest ? amount : highest), 0n);
  const span = max - min || 1n;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const months = Math.max(1, ordinal(last.month) - ordinal(first.month));
  const coordinates = points.map((point) => ({
    ...point,
    x: 24 + ((ordinal(point.month) - ordinal(first.month)) * 452) / months,
    y: 30 + ratio(max - BigInt(point.availability.minorUnits), span, 130),
  }));
  const zero = 30 + ratio(max, span, 130);
  return (
    <>
      <svg
        className="availability-chart"
        viewBox="0 0 500 200"
        role="img"
        aria-label={t('trendTitle')}
      >
        <line x1="24" x2="476" y1={zero} y2={zero} className="chart-zero" />
        {coordinates.map((point, index) => {
          const previous = coordinates[index - 1];
          return (
            <g key={point.month}>
              {previous && ordinal(point.month) - ordinal(previous.month) === 1 && (
                <line
                  x1={previous.x}
                  y1={previous.y}
                  x2={point.x}
                  y2={point.y}
                  className="chart-series"
                  strokeDasharray={
                    point.state === 'draft' || previous.state === 'draft' ? '6 5' : undefined
                  }
                />
              )}
              <circle cx={point.x} cy={point.y} r="5" className="chart-dot">
                <title>{`${monthLabel(point.month, i18n.resolvedLanguage)}: ${formatMoney(point.availability, i18n.resolvedLanguage)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <p className="chart-period">
        <span>{monthLabel(first.month, i18n.resolvedLanguage)}</span>
        <span>{monthLabel(last.month, i18n.resolvedLanguage)}</span>
      </p>
      <details className="chart-data">
        <summary>{t('exactValues')}</summary>
        <table>
          <thead>
            <tr>
              <th>{t('month')}</th>
              <th>{t('status')}</th>
              <th>{t('availability')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{monthLabel(point.month, i18n.resolvedLanguage)}</th>
                <td>{t(point.state)}</td>
                <td>{formatMoney(point.availability, i18n.resolvedLanguage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="field-hint">{t('draftLineHint')}</p>
    </>
  );
}

function BudgetChart({ summary }: { summary: MonthlyPlan['summary'] }) {
  const { t, i18n } = useTranslation('planning');
  const income = BigInt(summary.spendableIncome.minorUnits);
  const available = BigInt(summary.plannedAvailability.minorUnits);
  const values: Array<{ key: string; amount: Money; color: string }> = [
    { key: 'costs', amount: summary.monthlyCosts, color: '#526e87' },
    { key: 'provisions', amount: summary.annualProvisions, color: '#ad8437' },
    { key: 'investment', amount: summary.plannedInvestment, color: '#80739c' },
    { key: 'availability', amount: summary.plannedAvailability, color: '#0f766e' },
  ];
  let offset = 0;
  const slices = values.map((value) => {
    const size = ratio(BigInt(value.amount.minorUnits), income);
    const start = offset;
    offset += size;
    return { ...value, size, start };
  });
  return (
    <section className="planning-panel">
      <h2>{t('budgetTitle')}</h2>
      {income > 0n && available >= 0n ? (
        <svg
          className="budget-chart"
          viewBox="0 0 160 160"
          role="img"
          aria-label={t('budgetTitle')}
        >
          <g transform="rotate(-90 80 80)">
            {slices.map((slice) => (
              <circle
                key={slice.key}
                cx="80"
                cy="80"
                r="55"
                fill="none"
                stroke={slice.color}
                strokeWidth="15"
                pathLength="1000"
                strokeDasharray={`${slice.size} ${1000 - slice.size}`}
                strokeDashoffset={-slice.start}
              />
            ))}
          </g>
        </svg>
      ) : (
        <p className="chart-empty-copy">
          {t(available < 0n ? 'shortfallChartHint' : 'zeroIncomeChartHint')}
        </p>
      )}
      <dl className="budget-legend-live">
        {values.map((value) => (
          <div key={value.key}>
            <dt>
              <span style={{ background: value.color }} aria-hidden="true" />
              {t(value.key)}
            </dt>
            <dd>{formatMoney(value.amount, i18n.resolvedLanguage)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
