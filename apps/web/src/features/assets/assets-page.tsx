import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LoadingState, ConnectionError } from '../../components/ui/feedback';
import { Field, Pagination } from '../finance/shared';
import { useFinancialContext } from '../finance/use-financial-context';
import { formatMoney, decimalInput } from '../finance/presentation';
import { SourceEditor } from '../finance/source-editor';
import type { Session } from '../auth/session';
import { AssetEditor } from './asset-editor';
import { ReportDialog } from './record-dialogs';
import type { AssetKind, Financing, Investment } from './asset-api';
import { refreshAssets, formatReportedDate } from './asset-api';

export function AssetsPage({ kind }: { kind: AssetKind }) {
  const { t, i18n } = useTranslation(['assets', 'finance']);
  const session = useOutletContext<Session>();
  const context = useFinancialContext(session.user.id);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ record: Financing | Investment | null } | null>(null);
  const [reporting, setReporting] = useState<Financing | Investment | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const records = useQuery({
    queryKey: [kind, session.user.id, page, q],
    queryFn: async ({ signal }) => {
      const options = { signal, params: { query: { page, pageSize: 25, q } } };
      return kind === 'financing'
        ? requireData(await api.GET('/api/v1/financings', options))
        : requireData(await api.GET('/api/v1/investments', options));
    },
  });
  return (
    <>
      <header className="financial-page-heading">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t(kind === 'financing' ? 'financingTitle' : 'investmentsTitle')}</h1>
          <p>{t(kind === 'financing' ? 'financingDescription' : 'investmentsDescription')}</p>
        </div>
        <Button disabled={!context.data} onClick={() => setEditing({ record: null })}>
          {t(kind === 'financing' ? 'createFinancing' : 'createInvestment')}
        </Button>
      </header>
      <div className="data-toolbar">
        <Field id="asset-search" label={t('finance:search')}>
          <Input
            id="asset-search"
            type="search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </Field>
      </div>
      {context.isError && <ConnectionError retry={() => void context.refetch()} />}
      {records.isPending ? (
        <LoadingState />
      ) : records.isError ? (
        <ConnectionError retry={() => void records.refetch()} />
      ) : records.data.items.length === 0 ? (
        <section className="data-empty">
          <h2>{t('emptyTitle')}</h2>
          <p>{t(kind === 'financing' ? 'emptyFinancing' : 'emptyInvestment')}</p>
        </section>
      ) : (
        <div className="asset-grid">
          {records.data.items.map((record) => (
            <article className="asset-card" key={record.id}>
              <header>
                <h2>{record.name}</h2>
                <p>
                  {'lender' in record
                    ? record.lender
                    : [record.platform, record.ticker].filter(Boolean).join(' · ')}
                </p>
              </header>
              {'lender' in record ? (
                <dl className="asset-values">
                  <div>
                    <dt>{t('plannedMonthly')}</dt>
                    <dd>{formatMoney(record.planning.monthlyCharge, i18n.resolvedLanguage)}</dd>
                  </div>
                  <div>
                    <dt>{t('reportedDebt')}</dt>
                    <dd>
                      {record.latestDebt
                        ? formatMoney(record.latestDebt.amount, i18n.resolvedLanguage)
                        : t('unknown')}
                    </dd>
                  </div>
                  {record.latestDebt && (
                    <div>
                      <dt>{t('asOf')}</dt>
                      <dd>{formatReportedDate(record.latestDebt.asOf, i18n.resolvedLanguage)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t('originalPrincipal')}</dt>
                    <dd>
                      {record.originalPrincipal
                        ? formatMoney(record.originalPrincipal, i18n.resolvedLanguage)
                        : t('unknown')}
                    </dd>
                  </div>
                </dl>
              ) : (
                <>
                  <dl className="asset-values">
                    <div>
                      <dt>{t('recordedIn')}</dt>
                      <dd>{formatMoney(record.summary.moneyIn, i18n.resolvedLanguage)}</dd>
                    </div>
                    <div>
                      <dt>{t('recordedOut')}</dt>
                      <dd>{formatMoney(record.summary.moneyOut, i18n.resolvedLanguage)}</dd>
                    </div>
                    {record.summary.units !== null && (
                      <div>
                        <dt>{t('units')}</dt>
                        <dd>{decimalInput(record.summary.units)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{t('manualValuation')}</dt>
                      <dd>
                        {record.latestValuation
                          ? formatMoney(record.latestValuation.amount, i18n.resolvedLanguage)
                          : t('unknown')}
                      </dd>
                    </div>
                  </dl>
                  {record.latestValuation && (
                    <p className="field-hint">
                      {t('valuationDate', {
                        date: formatReportedDate(
                          record.latestValuation.asOf,
                          i18n.resolvedLanguage,
                        ),
                      })}
                    </p>
                  )}
                  {record.valuationStale && <p className="record-status">{t('staleValuation')}</p>}
                  {record.summary.openingCapitalUnknown && (
                    <p className="field-hint">{t('partialCapital')}</p>
                  )}
                </>
              )}
              {record.planning && (
                <p className="field-hint">
                  {t(record.planning.active ? 'planLinked' : 'planInactive', {
                    name: record.planning.definition.name,
                    month: record.planning.definition.effectiveFromMonth,
                  })}
                </p>
              )}
              <div className="record-actions">
                <Button
                  variant="outline"
                  disabled={!context.data}
                  onClick={() => setEditing({ record })}
                >
                  {t('finance:edit')}
                </Button>
                <Button
                  variant="outline"
                  disabled={!context.data}
                  onClick={() => setReporting(record)}
                >
                  {t(kind === 'financing' ? 'reportDebt' : 'reportValuation')}
                </Button>
                {record.planning && (
                  <Button
                    variant="outline"
                    disabled={!context.data}
                    onClick={() => setSourceId(record.planning?.id ?? null)}
                  >
                    {t('editPlan')}
                  </Button>
                )}
                {'summary' in record && (
                  <Button asChild>
                    <Link to={`/investments/${record.id}`}>{t('movements')}</Link>
                  </Button>
                )}
                {'lender' in record && (
                  <Button asChild variant="outline">
                    <Link to={`/financing/${record.id}`}>{t('reports')}</Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {records.data && (
        <Pagination
          page={page}
          pageSize={records.data.pageSize}
          total={records.data.total}
          onChange={setPage}
        />
      )}
      {editing && context.data && (
        <AssetEditor
          kind={kind}
          existing={editing.record}
          userId={session.user.id}
          context={context.data}
          onClose={() => setEditing(null)}
        />
      )}
      {reporting && context.data && (
        <ReportDialog
          kind={kind}
          record={reporting}
          userId={session.user.id}
          today={context.data.today}
          onClose={() => setReporting(null)}
        />
      )}
      {sourceId && context.data && (
        <SourceEditor
          kind="commitments"
          id={sourceId}
          userId={session.user.id}
          context={context.data}
          onClose={() => {
            setSourceId(null);
            void refreshAssets(session.user.id);
          }}
        />
      )}
    </>
  );
}
