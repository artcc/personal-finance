import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { ConnectionError, LoadingState } from '../components/ui/feedback';
import { logout } from '../features/auth/auth-api';
import { useSession } from '../features/auth/session';

export function AppShell() {
  const { t } = useTranslation(['shell', 'common']);
  const session = useSession();
  const drawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const planningMonth = /^\/planning\/(\d{4}-\d{2})(?:\/|$)/.exec(pathname)?.[1];
  const overviewPath = planningMonth ? `/planning/${planningMonth}` : '/';
  const allocationPath = planningMonth ? `/planning/${planningMonth}/allocation` : '/allocation';
  useEffect(() => {
    main.current?.focus();
  }, [pathname, session.data?.user.id]);
  const signOut = useMutation({ mutationFn: () => logout() });
  if (session.isPending) return <LoadingState />;
  if (session.isError) return <ConnectionError retry={() => void session.refetch()} />;
  if (!session.data) return <Navigate to="/login" replace />;
  const name = session.data.user.displayName;
  const navigation = (mobile = false) => (
    <>
      <LinkBrand />
      <nav aria-label={t('navigation')} className="app-navigation">
        <p className="nav-section-label">{t('workspace')}</p>
        <NavLink to={overviewPath} end onClick={() => drawer.current?.close()}>
          <span aria-hidden="true">▦</span>
          {t('overview')}
        </NavLink>
        <NavLink to={allocationPath} onClick={() => drawer.current?.close()}>
          <span aria-hidden="true">⇄</span>
          {t('allocation')}
        </NavLink>
        {(['accounts', 'income', 'commitments'] as const).map((item) => (
          <NavLink key={item} to={`/${item}`} onClick={() => drawer.current?.close()}>
            <span aria-hidden="true">◦</span>
            {t(item)}
          </NavLink>
        ))}
        {(['financing', 'investments'] as const).map((item) => (
          <NavLink to={`/${item}`} onClick={() => drawer.current?.close()} key={item}>
            <span aria-hidden="true">◦</span>
            {t(item)}
          </NavLink>
        ))}
        <p className="nav-section-label nav-section-label--secondary">{t('account')}</p>
        <NavLink to="/settings/security" onClick={() => drawer.current?.close()}>
          <span aria-hidden="true">◇</span>
          {t('security')}
        </NavLink>
        <NavLink to="/settings/data" onClick={() => drawer.current?.close()}>
          <span aria-hidden="true">⇅</span>
          {t('data')}
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <p>{t('privateSpace')}</p>
        <Button
          variant="outline"
          disabled={signOut.isPending}
          onClick={() => {
            if (mobile) drawer.current?.close();
            signOut.mutate();
          }}
        >
          {t('logout')}
        </Button>
      </div>
    </>
  );

  return (
    <div className="authenticated-layout">
      <a href="#private-content" className="skip-link">
        {t('common:skipToContent')}
      </a>
      <aside className="desktop-sidebar">{navigation()}</aside>
      <dialog className="mobile-drawer" ref={drawer} aria-label={t('navigation')}>
        <Button
          className="drawer-close"
          variant="outline"
          onClick={() => drawer.current?.close()}
          aria-label={t('closeNavigation')}
        >
          ×
        </Button>
        {navigation(true)}
      </dialog>
      <div className="workspace-content">
        <header className="workspace-header">
          <div className="workspace-header-inner">
            <Button
              className="mobile-menu"
              variant="outline"
              onClick={() => drawer.current?.showModal()}
              aria-label={t('openNavigation')}
            >
              ☰
            </Button>
            <span className="workspace-breadcrumb">{t('workspace')}</span>
            <NavLink
              to="/settings/security"
              className="profile-link"
              aria-label={t('openProfile', { name })}
            >
              <span className="profile-name">{name}</span>
              <span className="profile-avatar" aria-hidden="true">
                {name.slice(0, 1).toLocaleUpperCase()}
              </span>
            </NavLink>
          </div>
        </header>
        <main id="private-content" className="private-content" tabIndex={-1} ref={main}>
          {signOut.isError && (
            <p className="feedback-banner feedback-banner--error" role="alert">
              {t('logoutError')}
            </p>
          )}
          <Outlet context={session.data} />
        </main>
      </div>
    </div>
  );
}

function LinkBrand() {
  const { t } = useTranslation('common');
  return (
    <NavLink className="brand" to="/">
      <span className="brand-mark" aria-hidden="true">
        ∑
      </span>
      {t('appName')}
    </NavLink>
  );
}
