import { createApiClient } from '@personal-finance/api-client';
import { clearPrivateQueries, queryClient } from '../app/query-client';

export const api = createApiClient();

api.use({
  onResponse({ response }) {
    if (response.status === 401) {
      clearPrivateQueries();
      queryClient.setQueryData(['auth', 'session'], null);
    }
  },
});
