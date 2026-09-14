import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import common from '../src/i18n/locales/es-ES/common.json' with { type: 'json' };
import auth from '../src/i18n/locales/es-ES/auth.json' with { type: 'json' };
import shell from '../src/i18n/locales/es-ES/shell.json' with { type: 'json' };
import workspace from '../src/i18n/locales/es-ES/workspace.json' with { type: 'json' };
import security from '../src/i18n/locales/es-ES/security.json' with { type: 'json' };

const password = 'A browser example password 42';

async function registerUser(page: Page) {
  const email = `${randomUUID()}@example.test`;
  await page.goto('/register');
  await page.getByLabel(auth.name, { exact: true }).fill('Browser user');
  await page.getByLabel(auth.email, { exact: true }).fill(email);
  await page.getByLabel(auth.password, { exact: true }).fill(password);
  await page.getByLabel(auth.confirmation, { exact: true }).fill(password);
  await page.getByRole('button', { name: auth.registerAction, exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: workspace.emptyTitle })).toBeVisible();
  return email;
}

test('registration, session persistence, mobile navigation, and logout protect the workspace', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/settings/security');
  await expect(page).toHaveURL('/login');
  await expect(page).toHaveTitle(common.documentTitle);
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
  await registerUser(page);
  const otherTab = await page.context().newPage();
  await otherTab.goto('/settings/security');
  await expect(otherTab.getByRole('heading', { name: security.currentSession })).toBeVisible();
  await page.bringToFront();
  await page.reload();
  await expect(page.getByRole('heading', { name: workspace.emptyTitle })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });
  if (isMobile) await page.getByRole('button', { name: shell.openNavigation }).click();
  await page.getByRole('link', { name: shell.security, exact: true }).click();
  await expect(page.getByRole('heading', { name: security.currentSession })).toBeVisible();
  await page.getByRole('button', { name: security.logoutAll, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: security.confirmAction, exact: true })
    .click();
  await expect(page).toHaveURL('/login');
  await expect(otherTab).toHaveURL('/login');
  await otherTab.close();
  await page.goto('/settings/security');
  await expect(page).toHaveURL('/login');
});

test('login rejects invalid credentials and session loading recovers from a network error', async ({
  page,
}) => {
  const email = await registerUser(page);
  await page.goto('/settings/security');
  await page.getByRole('button', { name: security.logoutAll, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: security.confirmAction, exact: true })
    .click();
  await expect(page).toHaveURL('/login');
  await page.getByLabel(auth.email, { exact: true }).fill(email);
  await page.getByLabel(auth.password, { exact: true }).fill('An incorrect browser password');
  await page.getByRole('button', { name: auth.loginAction, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(auth.errors.invalidCredentials);
  await page.getByLabel(auth.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: auth.loginAction, exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText(common.connectionError);
  await page.unroute('**/api/v1/auth/session');
  await page.getByRole('button', { name: common.retry, exact: true }).click();
  await expect(page.getByRole('heading', { name: workspace.emptyTitle })).toBeVisible();
});

test('registration checks password confirmation without submitting an account', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel(auth.name, { exact: true }).fill('Browser user');
  await page.getByLabel(auth.email, { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByLabel(auth.password, { exact: true }).fill(password);
  await page.getByLabel(auth.confirmation, { exact: true }).fill('A different long password');
  await page.getByRole('button', { name: auth.registerAction, exact: true }).click();
  await expect(page.getByText(auth.validation.passwordMismatch)).toBeVisible();
  await expect(page).toHaveURL('/register');
});
