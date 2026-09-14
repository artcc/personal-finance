import { expect, test } from '@playwright/test';
import common from '../src/i18n/locales/es-ES/common.json';
import foundation from '../src/i18n/locales/es-ES/foundation.json';

test('the Spanish foundation page connects to the API without horizontal overflow', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle(common.documentTitle);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(foundation.heading);
  await expect(page.getByRole('status')).toHaveText(foundation.connectionSuccess);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('foundation.png'), fullPage: true });
});

test('a failed API request shows localized feedback and supports retry', async ({ page }) => {
  await page.route('**/api/v1/health/live', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText(foundation.connectionError);
  await expect(page.getByText(foundation.connectionErrorHint)).toBeVisible();
  await page.unroute('**/api/v1/health/live');
  await page.getByRole('button', { name: common.retry, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(foundation.connectionSuccess);
});
