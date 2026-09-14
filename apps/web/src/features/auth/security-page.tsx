import { useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { api } from '../../lib/api';
import { requireData } from '../../lib/api-error';
import type { Session } from './session';
import { logout, revokeSession } from './auth-api';

export function SecurityPage() {
  const { t, i18n } = useTranslation('security');
  const session = useOutletContext<Session>();
  const confirmation = useRef<HTMLDialogElement>(null);
  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async ({ signal }) => requireData(await api.GET('/api/v1/auth/sessions', { signal })),
  });
  const revoke = useMutation({ mutationFn: revokeSession });
  const logoutAll = useMutation({ mutationFn: () => logout(true) });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  return (
    <>
      <header className="private-page-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <section className="security-profile" aria-labelledby="identity-heading">
        <h2 id="identity-heading">{t('identityTitle')}</h2>
        <dl>
          <div>
            <dt>{t('name')}</dt>
            <dd>{session.user.displayName}</dd>
          </div>
          <div>
            <dt>{t('email')}</dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>
        <p className="field-hint">{t('emailNotice')}</p>
      </section>
      <section className="sessions-panel" aria-labelledby="sessions-heading">
        <div className="section-heading">
          <div>
            <h2 id="sessions-heading">{t('sessionsTitle')}</h2>
            <p>{t('sessionsDescription')}</p>
          </div>
          <Button variant="outline" onClick={() => confirmation.current?.showModal()}>
            {t('logoutAll')}
          </Button>
        </div>
        {(revoke.isError || logoutAll.isError) && (
          <p className="feedback-banner feedback-banner--error" role="alert">
            {t('actionError')}
          </p>
        )}
        {sessions.isPending ? (
          <LoadingState />
        ) : sessions.isError ? (
          <ConnectionError retry={() => void sessions.refetch()} />
        ) : (
          <ul className="session-list">
            {sessions.data.map((item) => (
              <li key={item.id}>
                <div className="session-item-main">
                  <span className="session-icon" aria-hidden="true">
                    ◇
                  </span>
                  <div>
                    <h3>{t(item.current ? 'currentSession' : 'otherSession')}</h3>
                    <p>{t('created', { date: date(item.createdAt) })}</p>
                    <p>{t('lastSeen', { date: date(item.lastSeenAt) })}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(item.id)}
                  aria-label={t('revokeLabel', { date: date(item.createdAt) })}
                >
                  {t('revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <dialog
        className="confirmation-dialog"
        ref={confirmation}
        aria-labelledby="logout-all-heading"
      >
        <h2 id="logout-all-heading">{t('confirmTitle')}</h2>
        <p>{t('confirmDescription')}</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => confirmation.current?.close()}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => {
              confirmation.current?.close();
              logoutAll.mutate();
            }}
          >
            {t('confirmAction')}
          </Button>
        </div>
      </dialog>
    </>
  );
}
