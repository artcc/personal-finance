import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import type { components } from '@personal-finance/api-client';
import auth from '../src/i18n/locales/es-ES/auth.json' with { type: 'json' };
import planning from '../src/i18n/locales/es-ES/planning.json' with { type: 'json' };

test('prepare, allocate, close, and reopen a month while preserving its closed version', async ({
  page,
  baseURL,
}, testInfo) => {
  await page.goto('/register');
  await page.getByLabel(auth.name, { exact: true }).fill('Monthly planning user');
  await page.getByLabel(auth.email, { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByLabel(auth.password, { exact: true }).fill('A monthly planning password 42');
  await page.getByLabel(auth.confirmation, { exact: true }).fill('A monthly planning password 42');
  await page.getByRole('button', { name: auth.registerAction, exact: true }).click();
  await expect(page.getByRole('heading', { name: planning.emptyTitle })).toBeVisible();
  if (!baseURL) throw new Error('Missing browser base URL');
  const sessionResponse = await page.request.get(`${baseURL}/api/v1/auth/session`);
  expect(sessionResponse.status()).toBe(200);
  const session = (await sessionResponse.json()) as components['schemas']['CurrentSessionDto'];
  const headers = { origin: baseURL, 'x-csrf-token': session.csrfToken };
  const contextResponse = await page.request.get(`${baseURL}/api/v1/financial-context`);
  const context = (await contextResponse.json()) as components['schemas']['FinancialContextDto'];
  const accountResponse = await page.request.post(`${baseURL}/api/v1/accounts`, {
    headers,
    data: { name: 'Month account', currency: 'EUR', institution: null, reference: null },
  });
  expect(accountResponse.status()).toBe(201);
  const account = (await accountResponse.json()) as components['schemas']['AccountDto'];
  const period = {
    name: 'Salary fixture',
    effectiveFromMonth: context.month,
    startsOn: `${context.month}-01`,
    endsOn: null,
    destination: { accountId: account.id, spaceId: null },
  };
  const income = await page.request.post(`${baseURL}/api/v1/income-sources`, {
    headers,
    data: {
      input: {
        ...period,
        kind: 'salary',
        netSalary: { currency: 'EUR', minorUnits: '200000' },
        base: null,
        hourlyRate: null,
        hours: null,
        vatRate: '0',
        withholdingRate: '0',
        commissionRate: '0',
      },
    },
  });
  expect(income.status()).toBe(201);
  const costResponse = await page.request.post(`${baseURL}/api/v1/commitments`, {
    headers,
    data: {
      input: {
        ...period,
        name: 'Monthly cost fixture',
        kind: 'fixed',
        frequency: 'monthly',
        amount: { currency: 'EUR', minorUnits: '110000' },
        dueDay: null,
        installments: [],
      },
    },
  });
  expect(costResponse.status()).toBe(201);
  const cost = (await costResponse.json()) as components['schemas']['CommitmentRecordDto'];

  await page.getByRole('button', { name: planning.prepare, exact: true }).click();
  await expect(page.locator('.plan-hero-amount')).toContainText('900,00');
  await page.getByRole('link', { name: planning.reviewAllocation, exact: true }).first().click();
  await page.getByRole('button', { name: planning.addAllocation, exact: true }).click();
  await page.locator('#allocation-amount-1').fill('600,00');
  await page.getByRole('button', { name: planning.addAllocation, exact: true }).click();
  await page.locator('#purpose-2').selectOption('remaining');
  await page.getByRole('checkbox', { name: planning.automaticRemainder, exact: true }).check();
  await page.getByRole('button', { name: planning.saveAllocation, exact: true }).click();
  await expect(page.getByText(planning.savedAllocation, { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: planning.navigation })
    .getByRole('link', { name: planning.overviewTab, exact: true })
    .click();
  await expect(page.locator('.plan-hero-amount')).toContainText('900,00');
  await page.getByRole('button', { name: planning.closeAction, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: planning.closeAction, exact: true })
    .click();
  await expect(page.locator('.closed-plan-notice')).toBeVisible();

  const revision = await page.request.post(`${baseURL}/api/v1/commitments/${cost.id}/revisions`, {
    headers,
    data: {
      expectedVersion: cost.version,
      input: { ...cost.revision.input, amount: { currency: 'EUR', minorUnits: '120000' } },
    },
  });
  expect(revision.status()).toBe(201);
  await page.reload();
  await expect(page.locator('.plan-hero-amount')).toContainText('900,00');
  await page.getByRole('button', { name: planning.reopenAction, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(planning.reason, { exact: true })
    .fill('Review the next revision');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: planning.reopenAction, exact: true })
    .click();
  await expect(page.locator('.closed-plan-notice')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: planning.navigation })
    .getByRole('link', { name: planning.historyTab, exact: true })
    .click();
  await page
    .locator('.plan-history-list li')
    .filter({ hasText: planning.closed })
    .getByRole('button', { name: planning.viewRevision, exact: true })
    .click();
  await expect(page.locator('.historical-plan .plan-hero-amount')).toContainText('900,00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('monthly-history.png'), fullPage: true });
});
