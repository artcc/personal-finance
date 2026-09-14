import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';

export function FoundationPage() {
  const { t } = useTranslation(['common', 'foundation']);
  const connection = useQuery({
    queryKey: ['system', 'liveness'],
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/health/live', { signal });
      if (!result.response.ok || !result.data) throw new Error('API_UNAVAILABLE');
      return result.data;
    },
    retry: false,
  });
  const state = connection.isFetching ? 'pending' : connection.isError ? 'error' : 'success';
  const statusKey = {
    pending: 'connectionPending',
    error: 'connectionError',
    success: 'connectionSuccess',
  } as const;

  return (
    <div className="app-canvas">
      <a href="#main-content" className="skip-link">
        {t('skipToContent')}
      </a>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ∑
          </span>
          <span>{t('appName')}</span>
        </div>
        <span className="stage-badge">{t('foundation:badge')}</span>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <section className="intro" aria-labelledby="page-heading">
          <p className="eyebrow">{t('foundation:eyebrow')}</p>
          <h1 id="page-heading">{t('foundation:heading')}</h1>
          <p className="intro-description">{t('foundation:description')}</p>
        </section>
        <section className="connection-panel" aria-labelledby="connection-heading">
          <div>
            <p className="section-kicker">{t('foundation:badge')}</p>
            <h2 id="connection-heading">{t('foundation:connectionTitle')}</h2>
            <p>{t('foundation:connectionDescription')}</p>
          </div>
          <div className="connection-detail">
            <p
              className={`connection-state connection-state--${state}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" aria-hidden="true" />
              {t(`foundation:${statusKey[state]}`)}
            </p>
            {state !== 'pending' && (
              <p className="connection-hint">
                {t(
                  state === 'error'
                    ? 'foundation:connectionErrorHint'
                    : 'foundation:connectionSuccessHint',
                )}
              </p>
            )}
            <Button
              variant="outline"
              disabled={connection.isFetching}
              onClick={() => void connection.refetch()}
            >
              {t(connection.isFetching ? 'retrying' : 'retry')}
            </Button>
          </div>
        </section>
        <section className="scope-section" aria-labelledby="scope-heading">
          <div className="section-heading">
            <div>
              <h2 id="scope-heading">{t('foundation:scopeTitle')}</h2>
              <p>{t('foundation:scopeDescription')}</p>
            </div>
            <span className="section-kicker">{t('foundation:upcoming')}</span>
          </div>
          <div className="feature-grid">
            {(['planning', 'allocation', 'history'] as const).map((feature, index) => (
              <article className="feature-card" key={feature}>
                <span className="feature-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{t(`foundation:${feature}Title`)}</h3>
                <p>{t(`foundation:${feature}Description`)}</p>
              </article>
            ))}
          </div>
          <p className="scope-note">{t('foundation:noFinancialData')}</p>
        </section>
      </main>
      <footer className="site-footer">{t('footer')}</footer>
    </div>
  );
}
