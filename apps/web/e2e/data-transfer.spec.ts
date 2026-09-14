import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { components } from '@personal-finance/api-client';
import { test, expect } from './fixtures';
import auth from '../src/i18n/locales/es-ES/auth.json' with { type: 'json' };
import planning from '../src/i18n/locales/es-ES/planning.json' with { type: 'json' };
import data from '../src/i18n/locales/es-ES/data.json' with { type: 'json' };

test('a user downloads JSON and imports it into an empty private workspace', async ({
  page,
  baseURL,
}, testInfo) => {
  if (!baseURL) throw new Error('Missing base URL');
  const register = async () => {
    await page.goto('/register');
    await page.getByLabel(auth.name, { exact: true }).fill('JSON browser user');
    await page.getByLabel(auth.email, { exact: true }).fill(`${randomUUID()}@example.test`);
    await page.getByLabel(auth.password, { exact: true }).fill('A JSON browser password 42');
    await page.getByLabel(auth.confirmation, { exact: true }).fill('A JSON browser password 42');
    await page.getByRole('button', { name: auth.registerAction, exact: true }).click();
    await expect(page.getByRole('heading', { name: planning.emptyTitle })).toBeVisible();
  };
  await register();
  const session = (await (
    await page.request.get(`${baseURL}/api/v1/auth/session`)
  ).json()) as components['schemas']['CurrentSessionDto'];
  const headers = { origin: baseURL, 'x-csrf-token': session.csrfToken };
  const created = await page.request.post(`${baseURL}/api/v1/accounts`, {
    headers,
    data: { name: 'Imported account example', currency: 'EUR', institution: null, reference: null },
  });
  expect(created.status()).toBe(201);
  await page.goto('/settings/data');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: data.exportAction, exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('personal-finance.json');
  const file = testInfo.outputPath('financial-data.json');
  await download.saveAs(file);
  const exported = JSON.parse(await readFile(file, 'utf8')) as {
    format: string;
    formatVersion: number;
  };
  expect(exported.format).toBe('personal-finance');
  expect(exported.formatVersion).toBe(1);
  const logout = await page.request.post(`${baseURL}/api/v1/auth/logout`, { headers, data: {} });
  expect(logout.status()).toBe(204);
  await register();
  await page.goto('/settings/data');
  await page.getByLabel(data.file, { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: data.reviewAction, exact: true }).click();
  await page.getByRole('checkbox', { name: data.confirmImport, exact: true }).check();
  await page.getByRole('button', { name: data.importAction, exact: true }).click();
  await expect(page.locator('.data-import-success')).toBeVisible();
  await page.goto('/accounts');
  await expect(
    page.getByRole('heading', { name: 'Imported account example', exact: true }),
  ).toBeVisible();
});
