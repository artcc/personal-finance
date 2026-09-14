import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/bootstrap.js';
import { readEnvironment } from '../dist/shared/environment.js';
import { DatabaseService } from '../dist/shared/database.service.js';
import type { CurrentSessionDto } from '../dist/modules/identity/http/auth.dto.js';
import type { AccountDto } from '../dist/modules/accounts/http/accounts.dto.js';
import type { MonthlyPlanDto } from '../dist/modules/planning/http/planning.dto.js';
import type { InvestmentDto } from '../dist/modules/investments/http/investments.dto.js';
import type { ImportPreviewDto } from '../dist/modules/data-portability/http/data.dto.js';
import { parseDocument } from '../dist/modules/data-portability/application/document.js';
import type { FinancialDocument } from '../dist/modules/data-portability/application/document.js';
import { money } from '../src/shared/domain/money.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test'))
  throw new Error('Data portability tests require a disposable TEST_DATABASE_URL ending in _test.');
const origin = 'http://127.0.0.1:4173';
type Actor = { id: string; headers: { origin: string; cookie: string; 'x-csrf-token': string } };
let running: Awaited<ReturnType<typeof createApplication>>;
let source: Actor;
let target: Actor;
let isolated: Actor;
let document: FinancialDocument;
async function request(
  actor: Actor,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  payload: object | null = null,
) {
  return running.app.inject({
    method,
    url: `/api/v1/${path}`,
    headers: actor.headers,
    ...(payload === null ? {} : { payload }),
  });
}
beforeAll(async () => {
  running = await createApplication(
    readEnvironment({ NODE_ENV: 'test', APP_ORIGIN: origin, DATABASE_URL: databaseUrl }),
  );
  const register = async (): Promise<Actor> => {
    const response = await running.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin },
      payload: {
        email: `${randomUUID()}@example.test`,
        displayName: 'Data file user',
        password: 'A data file fixture password 42',
      },
    });
    expect(response.statusCode).toBe(201);
    const user = response.json<CurrentSessionDto>();
    const raw = response.headers['set-cookie'];
    const cookie = Array.isArray(raw) ? raw[0] : raw;
    if (!cookie) throw new Error('Missing cookie');
    return {
      id: user.user.id,
      headers: { origin, cookie: cookie.split(';')[0] ?? '', 'x-csrf-token': user.csrfToken },
    };
  };
  source = await register();
  target = await register();
  isolated = await register();
  const response = await request(source, 'POST', 'accounts', {
    name: 'JSON source account',
    currency: 'EUR',
    institution: null,
    reference: null,
  });
  expect(response.statusCode).toBe(201);
  const account = response.json<AccountDto>();
  const period = {
    effectiveFromMonth: '2026-01',
    startsOn: '2026-01-01',
    endsOn: null,
    destination: { accountId: account.id, spaceId: null },
  };
  expect(
    (
      await request(source, 'POST', 'income-sources', {
        input: {
          ...period,
          name: 'Source salary',
          kind: 'salary',
          netSalary: money(200000n),
          base: null,
          hourlyRate: null,
          hours: null,
          vatRate: '0',
          withholdingRate: '0',
          commissionRate: '0',
        },
      })
    ).statusCode,
  ).toBe(201);
  expect(
    (
      await request(source, 'POST', 'financings', {
        name: 'Source financing',
        lender: null,
        originalPrincipal: money(100000n),
        planning: {
          sourceId: null,
          expectedVersion: null,
          definition: {
            ...period,
            name: 'Loan payment',
            kind: 'financing',
            frequency: 'monthly',
            amount: money(10000n),
            dueDay: 20,
            installments: [],
          },
        },
      })
    ).statusCode,
  ).toBe(201);
  const investmentResponse = await request(source, 'POST', 'investments', {
    name: 'Source units',
    kind: 'crypto',
    mode: 'units',
    platform: null,
    ticker: 'TEST',
    planning: null,
  });
  expect(investmentResponse.statusCode).toBe(201);
  const investment = investmentResponse.json<InvestmentDto>();
  expect(
    (
      await request(source, 'POST', `investments/${investment.id}/entries`, {
        expectedVersion: investment.version,
        input: {
          date: '2026-01-02',
          kind: 'buy',
          quantity: '1.00000001',
          amount: money(12345n),
          note: null,
        },
      })
    ).statusCode,
  ).toBe(201);
  const prepared = await request(source, 'POST', 'monthly-plans', { month: '2026-02' });
  expect(prepared.statusCode).toBe(200);
  let plan = prepared.json<MonthlyPlanDto>();
  const allocation = await request(source, 'PUT', `monthly-plans/${plan.id}/allocations`, {
    expectedVersion: plan.version,
    allocations: [
      ...plan.allocations.map((item) => ({
        id: item.id,
        purpose: item.purpose,
        sourceLineId: item.sourceLineId,
        destination: { accountId: item.destination.accountId, spaceId: item.destination.spaceId },
        amount: item.amount,
        remainder: item.remainder,
      })),
      {
        id: 'remaining',
        purpose: 'remaining',
        sourceLineId: null,
        destination: { accountId: account.id, spaceId: null },
        amount: money(0n),
        remainder: true,
      },
    ],
  });
  expect(allocation.statusCode).toBe(200);
  plan = allocation.json<MonthlyPlanDto>();
  expect(
    (
      await request(source, 'POST', `monthly-plans/${plan.id}/close`, {
        expectedVersion: plan.version,
        acknowledgeShortfall: false,
      })
    ).statusCode,
  ).toBe(200);
}, 30000);
afterAll(async () => {
  await running?.app.close();
});

describe('Private JSON export and atomic import', () => {
  it('exports only the current user financial data and omits authentication state', async () => {
    const response = await request(source, 'GET', 'data/export');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['cache-control']).toBe('no-store');
    document = parseDocument(response.json());
    expect(document.data.accounts).toHaveLength(1);
    expect(document.data.accounts[0]?.name).toBe('JSON source account');
    const forbiddenKeys = new Set([
      'passwordHash',
      'tokenHash',
      'csrfToken',
      'credentialVersion',
      'sessions',
      'credentials',
    ]);
    const inspect = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(inspect);
      else if (value && typeof value === 'object')
        for (const [key, nested] of Object.entries(value)) {
          expect(forbiddenKeys.has(key)).toBe(false);
          inspect(nested);
        }
    };
    inspect(document);
    const other = parseDocument((await request(isolated, 'GET', 'data/export')).json());
    expect(other.data.accounts).toHaveLength(0);
    expect(
      (await running.app.inject({ method: 'GET', url: '/api/v1/data/export' })).statusCode,
    ).toBe(401);
  });
  it('previews without writes, rejects changed or incompatible files, and leaves no partial data', async () => {
    const preview = await request(target, 'POST', 'data/import-preview', document);
    expect(preview.statusCode).toBe(200);
    const reviewed = preview.json<ImportPreviewDto>();
    expect(reviewed.canImport).toBe(true);
    expect(
      await running.app.get(DatabaseService).client.account.count({ where: { userId: target.id } }),
    ).toBe(0);
    const changed = structuredClone(document);
    changed.exportedAt = '2026-01-01T00:00:00Z';
    expect(
      (
        await request(target, 'POST', 'data/import', {
          document: changed,
          fingerprint: reviewed.fingerprint,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await request(target, 'POST', 'data/import-preview', { ...document, formatVersion: 2 }))
        .statusCode,
    ).toBe(422);
    const broken = structuredClone(document);
    if (!broken.data.incomeRevisions[0]) throw new Error('Missing revision');
    broken.data.incomeRevisions[0].cashCents = '1';
    expect((await request(target, 'POST', 'data/import-preview', broken)).statusCode).toBe(422);
    expect(
      await running.app.get(DatabaseService).client.account.count({ where: { userId: target.id } }),
    ).toBe(0);
  });
  it('imports the complete graph with fresh IDs and preserves exact closed-plan amounts', async () => {
    const preview = (
      await request(target, 'POST', 'data/import-preview', document)
    ).json<ImportPreviewDto>();
    const imported = await request(target, 'POST', 'data/import', {
      document,
      fingerprint: preview.fingerprint,
    });
    expect(imported.statusCode).toBe(200);
    const copied = parseDocument((await request(target, 'GET', 'data/export')).json());
    expect(copied.data.accounts[0]?.id).not.toBe(document.data.accounts[0]?.id);
    expect(copied.data.incomeRevisions[0]?.accountId).toBe(copied.data.accounts[0]?.id);
    expect(copied.data.financings[0]?.planningSourceId).toBe(copied.data.commitmentSources[0]?.id);
    expect(copied.data.investmentEntries[0]?.quantity).toBe('1.00000001');
    const originalPlan = document.data.monthlyPlanRevisions[0];
    const copiedPlan = copied.data.monthlyPlanRevisions[0];
    if (!originalPlan || !copiedPlan) throw new Error('Missing plan fixture');
    expect(copiedPlan.summary).toEqual(originalPlan.summary);
    expect(copiedPlan.state).toBe('closed');
    expect(copiedPlan.snapshot.charges[0]?.sourceId).toBe(copied.data.commitmentSources[0]?.id);
    const read = await request(target, 'GET', 'monthly-plans?month=2026-02');
    expect(read.statusCode).toBe(200);
    expect(read.json<MonthlyPlanDto>().summary).toEqual(originalPlan.summary);
    expect(
      (await request(isolated, 'GET', `monthly-plans/${copied.data.monthlyPlans[0]?.id}/revisions`))
        .statusCode,
    ).toBe(404);
    expect(
      (await request(target, 'POST', 'data/import', { document, fingerprint: preview.fingerprint }))
        .statusCode,
    ).toBe(409);
    expect(
      await running.app.get(DatabaseService).client.account.count({ where: { userId: target.id } }),
    ).toBe(1);
    expect(
      (await request(source, 'GET', 'monthly-plans?month=2026-02')).json<MonthlyPlanDto>().summary,
    ).toEqual(originalPlan.summary);
  });
  it('rolls back earlier collections when a later database write fails', async () => {
    const database = running.app.get(DatabaseService);
    const preview = (
      await request(isolated, 'POST', 'data/import-preview', document)
    ).json<ImportPreviewDto>();
    // This fixed probe is created only in the disposable _test database and removed afterward.
    await database.client
      .$executeRaw`ALTER TABLE "financings" ADD CONSTRAINT "import_failure_probe" CHECK (false) NOT VALID`;
    try {
      const response = await request(isolated, 'POST', 'data/import', {
        document,
        fingerprint: preview.fingerprint,
      });
      expect(response.statusCode).toBe(500);
      expect(await database.client.account.count({ where: { userId: isolated.id } })).toBe(0);
      expect(await database.client.incomeSource.count({ where: { userId: isolated.id } })).toBe(0);
      expect(await database.client.commitmentSource.count({ where: { userId: isolated.id } })).toBe(
        0,
      );
      expect(await database.client.financialEvent.count({ where: { userId: isolated.id } })).toBe(
        0,
      );
    } finally {
      await database.client
        .$executeRaw`ALTER TABLE "financings" DROP CONSTRAINT "import_failure_probe"`;
    }
  });
});
