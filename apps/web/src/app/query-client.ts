import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
});

export function clearPrivateQueries(): void {
  queryClient.removeQueries({
    predicate: (query) => !(query.queryKey[0] === 'auth' && query.queryKey[1] === 'session'),
  });
}

const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('personal-finance-auth')
    : null;
if (channel)
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data !== 'changed') return;
    clearPrivateQueries();
    void queryClient.resetQueries({ queryKey: ['auth', 'session'], exact: true });
  };

export function notifySessionChanged(): void {
  channel?.postMessage('changed');
}
