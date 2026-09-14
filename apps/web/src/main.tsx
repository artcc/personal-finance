import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ErrorPage } from './app/error-page';
import { FoundationPage } from './features/foundation/foundation-page';
import { AppShell } from './app/app-shell';
import { AccessPage } from './features/auth/access-page';
import { SecurityPage } from './features/auth/security-page';
import { AccountsPage } from './features/accounts/accounts-page';
import { SourcesPage } from './features/finance/sources-page';
import { queryClient } from './app/query-client';
import i18n from './i18n';
import './styles.css';

document.documentElement.lang = i18n.resolvedLanguage ?? 'es-ES';
document.title = i18n.t('documentTitle');

const router = createBrowserRouter([
  { path: '/login', element: <AccessPage key="login" mode="login" />, errorElement: <ErrorPage /> },
  {
    path: '/register',
    element: <AccessPage key="register" mode="register" />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <FoundationPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'income', element: <SourcesPage key="income" kind="income" /> },
      { path: 'commitments', element: <SourcesPage key="commitments" kind="commitments" /> },
      { path: 'settings/security', element: <SecurityPage /> },
    ],
  },
]);
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
