import createClient from 'openapi-fetch';
import type { paths } from './schema.gen.js';

export type { paths, components, operations } from './schema.gen.js';

export function createApiClient(baseUrl = '') {
  return createClient<paths>({ baseUrl, credentials: 'same-origin' });
}
