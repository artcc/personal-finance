import { randomUUID } from 'node:crypto';
import type { components } from '@personal-finance/api-client';
import { test, expect } from './fixtures';
import auth from '../src/i18n/locales/es-ES/auth.json' with { type: 'json' };
import finance from '../src/i18n/locales/es-ES/finance.json' with { type: 'json' };
import assets from '../src/i18n/locales/es-ES/assets.json' with { type: 'json' };
import planning from '../src/i18n/locales/es-ES/planning.json' with { type: 'json' };

test('a user records a financing, debt, unit movements, and a manual valuation', async ({
  page,
  baseURL,
}, testInfo) => {
  await page.goto('/register');
  await page.getByLabel(auth.name, { exact: true }).fill('Asset browser user');
  await page.getByLabel(auth.email, { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByLabel(auth.password, { exact: true }).fill('An asset browser password 42');
  await page.getByLabel(auth.confirmation, { exact: true }).fill('An asset browser password 42');
  await page.getByRole('button', { name: auth.registerAction, exact: true }).click();
  await expect(page.getByRole('heading', { name: planning.emptyTitle })).toBeVisible();
  if (!baseURL) throw new Error('Missing base URL');
  const sessionResponse = await page.request.get(`${baseURL}/api/v1/auth/session`);
  const session = (await sessionResponse.json()) as components['schemas']['CurrentSessionDto'];
  const account = await page.request.post(`${baseURL}/api/v1/accounts`, {
    headers: { origin: baseURL, 'x-csrf-token': session.csrfToken },
    data: { name: 'Asset bank', currency: 'EUR', institution: null, reference: null },
  });
  expect(account.status()).toBe(201);

  await page.goto('/financing');
  await page.getByRole('button', { name: assets.createFinancing, exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(assets.name, { exact: true }).fill('Loan fixture');
  await dialog.getByLabel(assets.originalPrincipal, { exact: true }).fill('1000,00');
  await dialog.getByLabel(assets.monthlyPayment, { exact: true }).fill('100,00');
  await dialog.getByLabel(finance.account, { exact: true }).selectOption({ label: 'Asset bank' });
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Loan fixture', exact: true })).toBeVisible();
  await page.getByRole('button', { name: assets.reportDebt, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(assets.amount, { exact: true }).fill('950,00');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(page.locator('.asset-values')).toContainText('950,00');

  await page.goto('/investments');
  await page.getByRole('button', { name: assets.createInvestment, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(assets.name, { exact: true }).fill('Unit asset fixture');
  await dialog.getByLabel(assets.kind, { exact: true }).selectOption('crypto');
  await dialog.getByLabel(assets.recordingMode, { exact: true }).selectOption('units');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Unit asset fixture', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: assets.movements, exact: true }).click();
  await page.getByRole('button', { name: assets.addMovement, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(assets.units, { exact: true }).fill('2');
  await dialog.getByLabel(assets.amount, { exact: true }).fill('100,00');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(
    page.locator('.asset-summary-strip > span').filter({ hasText: assets.units }).locator('strong'),
  ).toHaveText('2');
  await page.getByRole('button', { name: assets.addMovement, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(assets.movementKind, { exact: true }).selectOption('sell');
  await dialog.getByLabel(assets.units, { exact: true }).fill('1');
  await dialog.getByLabel(assets.amount, { exact: true }).fill('80,00');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(
    page.locator('.asset-summary-strip > span').filter({ hasText: assets.units }).locator('strong'),
  ).toHaveText('1');
  await page.getByRole('button', { name: assets.reportValuation, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(assets.amount, { exact: true }).fill('130,00');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('investment-movements.png'), fullPage: true });
});
