import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ErrorPage } from './app/error-page';
import { FoundationPage } from './features/foundation/foundation-page';
import i18n from './i18n';
import './styles.css';

document.documentElement.lang = i18n.resolvedLanguage ?? 'es-ES';
document.title = i18n.t('documentTitle');

const router = createBrowserRouter([
  { path: '/', element: <FoundationPage />, errorElement: <ErrorPage /> },
]);
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
