import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import auth from '../src/i18n/locales/es-ES/auth.json' with { type: 'json' };
import accounts from '../src/i18n/locales/es-ES/accounts.json' with { type: 'json' };
import finance from '../src/i18n/locales/es-ES/finance.json' with { type: 'json' };
import sources from '../src/i18n/locales/es-ES/sources.json' with { type: 'json' };

test('a user configures an account, salary, and annual commitment with server previews', async ({
  page,
}, testInfo) => {
  await page.goto('/register');
  await page.getByLabel(auth.name, { exact: true }).fill('Configuration user');
  await page.getByLabel(auth.email, { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByLabel(auth.password, { exact: true }).fill('A configuration password 42');
  await page.getByLabel(auth.confirmation, { exact: true }).fill('A configuration password 42');
  await page.getByRole('button', { name: auth.registerAction, exact: true }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/accounts');
  await page.getByRole('button', { name: accounts.createAccount, exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(accounts.name, { exact: true }).fill('Planning account');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Planning account', exact: true })).toBeVisible();

  await page.goto('/income');
  await page.getByRole('button', { name: sources.createIncome, exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(sources.name, { exact: true }).fill('Net salary fixture');
  await dialog.getByLabel(sources.netSalary, { exact: true }).fill('1000,00');
  await dialog
    .getByLabel(finance.account, { exact: true })
    .selectOption({ label: 'Planning account' });
  await dialog.getByRole('button', { name: sources.calculate, exact: true }).click();
  await expect(dialog.locator('.preview-values')).toContainText('1.000,00');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Net salary fixture', exact: true }),
  ).toBeVisible();

  await page.goto('/commitments');
  await page.getByRole('button', { name: sources.createCommitment, exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(sources.name, { exact: true }).fill('Annual fixture');
  await dialog.getByLabel(sources.frequency, { exact: true }).selectOption('annual');
  await dialog.locator('#amount').fill('120,00');
  await dialog
    .getByLabel(finance.account, { exact: true })
    .selectOption({ label: 'Planning account' });
  await dialog.getByRole('button', { name: sources.addInstallment, exact: true }).click();
  await dialog.getByLabel(sources.monthNumber, { exact: true }).fill('11');
  await dialog.getByLabel(sources.day, { exact: true }).fill('20');
  await dialog.locator('#installment-amount-0').fill('120,00');
  await dialog.getByRole('button', { name: sources.calculate, exact: true }).click();
  await expect(dialog.locator('.preview-value')).toContainText('10,00');
  await expect(dialog.getByRole('button', { name: finance.save, exact: true })).toBeEnabled();
  await dialog.locator('#amount').fill('121,00');
  await expect(dialog.getByRole('button', { name: finance.save, exact: true })).toBeDisabled();
  await dialog.locator('#amount').fill('120,00');
  await dialog.getByRole('button', { name: finance.save, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Annual fixture', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('financial-configuration.png'),
    fullPage: true,
  });
});
