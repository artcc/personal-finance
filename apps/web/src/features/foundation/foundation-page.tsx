import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import type { Session } from '../auth/session';

export function FoundationPage() {
  const { t } = useTranslation('workspace');
  const session = useOutletContext<Session>();
  return (
    <>
      <header className="private-page-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('welcome', { name: session.user.displayName })}</h1>
        <p>{t('description')}</p>
      </header>
      <section className="welcome-panel" aria-labelledby="welcome-heading">
        <div className="welcome-copy">
          <span className="section-kicker">{t('privateBadge')}</span>
          <h2 id="welcome-heading">{t('emptyTitle')}</h2>
          <p>{t('emptyDescription')}</p>
          <Button asChild>
            <Link to="/settings/security">{t('accountAction')}</Link>
          </Button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="art-card art-card--back" />
          <span className="art-card art-card--front">
            <i />
            <i />
            <i />
            <b>✓</b>
          </span>
        </div>
      </section>
      <section className="scope-section" aria-labelledby="next-heading">
        <div className="section-heading">
          <div>
            <h2 id="next-heading">{t('nextTitle')}</h2>
            <p>{t('nextDescription')}</p>
          </div>
          <span className="stage-badge">{t('upcoming')}</span>
        </div>
        <div className="feature-grid">
          {(['accounts', 'income', 'commitments'] as const).map((item, index) => (
            <article className="feature-card" key={item}>
              <span className="feature-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{t(`${item}Title`)}</h3>
              <p>{t(`${item}Description`)}</p>
              <Button asChild variant="outline">
                <Link to={`/${item}`}>{t('openModule')}</Link>
              </Button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
