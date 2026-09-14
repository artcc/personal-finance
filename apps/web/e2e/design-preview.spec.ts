import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('capture the synthetic financial design proposal for owner review', async ({
  page,
}, testInfo) => {
  await page.goto(pathToFileURL(resolve('docs/design/phase-3-preview.html')).href);
  for (const [button, name] of [
    ['Monthly overview', 'overview'],
    ['Account allocation', 'allocation'],
    ['Annual commitment', 'commitment'],
  ] as const) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.locator(`#${name}`)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`design-${name}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Monthly overview', exact: true }).click();
  for (const state of ['shortfall', 'closed', 'empty', 'loading', 'error']) {
    await page.getByLabel('Overview state', { exact: true }).selectOption(state);
    await page.screenshot({ path: testInfo.outputPath(`design-${state}.png`), fullPage: true });
  }
});
