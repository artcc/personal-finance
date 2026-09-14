import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/bootstrap.js';
import { readEnvironment } from '../dist/shared/environment.js';
import { DatabaseService } from '../dist/shared/database.service.js';
import type { CurrentSessionDto } from '../dist/modules/identity/http/auth.dto.js';
import type { AccountDto } from '../dist/modules/accounts/http/accounts.dto.js';
import type { CommitmentRecordDto } from '../dist/modules/commitments/http/commitments.dto.js';
import type { FinancingDto } from '../dist/modules/financing/http/financing.dto.js';
import type {
  InvestmentDto,
  MovementsPageDto,
} from '../dist/modules/investments/http/investments.dto.js';
import type { MonthlyPlanDto } from '../dist/modules/planning/http/planning.dto.js';
import { money } from '../src/shared/domain/money.js';

const url = process.env['TEST_DATABASE_URL'];
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Asset tests require a disposable TEST_DATABASE_URL ending in _test.');
const origin = 'http://127.0.0.1:4173';
type Actor = { id: string; headers: { origin: string; cookie: string; 'x-csrf-token': string } };
let running: Awaited<ReturnType<typeof createApplication>>;
let first: Actor;
let second: Actor;
let account: AccountDto;
let source: CommitmentRecordDto;
let financing: FinancingDto;
let investment: InvestmentDto;
async function request(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  payload: object | null = null,
  actor = first,
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
    readEnvironment({ NODE_ENV: 'test', DATABASE_URL: url, APP_ORIGIN: origin }),
  );
  const register = async (): Promise<Actor> => {
    const response = await running.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin },
      payload: {
        email: `${randomUUID()}@example.test`,
        displayName: 'Asset user',
        password: 'An asset fixture password 42',
      },
    });
    expect(response.statusCode).toBe(201);
    const data = response.json<CurrentSessionDto>();
    const raw = response.headers['set-cookie'];
    const cookie = Array.isArray(raw) ? raw[0] : raw;
    if (!cookie) throw new Error('Missing cookie');
    return {
      id: data.user.id,
      headers: { origin, cookie: cookie.split(';')[0] ?? '', 'x-csrf-token': data.csrfToken },
    };
  };
  first = await register();
  second = await register();
  const result = await request('POST', 'accounts', {
    name: 'Asset account',
    currency: 'EUR',
    institution: null,
    reference: null,
  });
  expect(result.statusCode).toBe(201);
  account = result.json<AccountDto>();
  const created = await request('POST', 'commitments', {
    input: {
      name: 'Existing payment',
      kind: 'financing',
      frequency: 'monthly',
      amount: money(10000n),
      effectiveFromMonth: '2026-01',
      startsOn: '2026-01-01',
      endsOn: null,
      destination: { accountId: account.id, spaceId: null },
      dueDay: null,
      installments: [],
    },
  });
  expect(created.statusCode).toBe(201);
  source = created.json<CommitmentRecordDto>();
}, 30_000);
afterAll(async () => {
  await running?.app.close();
});

describe('Financing and investment integrity', () => {
  it('links one financing without duplicating its planning commitment', async () => {
    const body = {
      name: 'Loan',
      lender: 'Example lender',
      originalPrincipal: money(100000n),
      planning: { sourceId: source.id, expectedVersion: source.version, definition: null },
    };
    const result = await request('POST', 'financings', body);
    expect(result.statusCode).toBe(201);
    financing = result.json<FinancingDto>();
    expect(
      await running.app
        .get(DatabaseService)
        .client.commitmentSource.count({ where: { userId: first.id } }),
    ).toBe(1);
    expect((await request('POST', 'financings', body)).statusCode).toBe(409);
    expect(
      (
        await request('POST', `commitments/${source.id}/revisions`, {
          expectedVersion: source.version,
          input: { ...source.revision.input, kind: 'fixed' },
        })
      ).statusCode,
    ).toBe(409);
    expect((await request('GET', `financings/${financing.id}`, null, second)).statusCode).toBe(404);
  });
  it('preserves dated debt reports without calculating amortization', async () => {
    const report = await request('POST', `financings/${financing.id}/balances`, {
      expectedVersion: financing.version,
      asOf: '2026-01-02',
      amount: money(95000n),
    });
    expect(report.statusCode).toBe(201);
    financing = report.json<FinancingDto>();
    expect(financing.latestDebt?.amount.minorUnits).toBe('95000');
    const older = await request('POST', `financings/${financing.id}/balances`, {
      expectedVersion: financing.version,
      asOf: '2026-01-01',
      amount: money(100000n),
    });
    expect(older.statusCode).toBe(201);
    financing = older.json<FinancingDto>();
    expect(financing.latestDebt?.amount.minorUnits).toBe('95000');
    expect(financing.planning.definition.amount.minorUnits).toBe('10000');
  });
  it('creates an optional contribution plan atomically and keeps actual purchases separate', async () => {
    const result = await request('POST', 'investments', {
      name: 'Units asset',
      platform: null,
      ticker: 'UNIT',
      kind: 'crypto',
      mode: 'units',
      planning: {
        sourceId: null,
        expectedVersion: null,
        definition: {
          ...source.revision.input,
          name: 'Investment plan',
          kind: 'investment',
          amount: money(5000n),
        },
      },
    });
    expect(result.statusCode).toBe(201);
    investment = result.json<InvestmentDto>();
    const plan = await request('POST', 'monthly-plans', { month: '2026-02' });
    expect(plan.statusCode).toBe(200);
    const snapshot = plan.json<MonthlyPlanDto>();
    expect(snapshot.summary.planningCharges.minorUnits).toBe('15000');
    const buy = await request('POST', `investments/${investment.id}/entries`, {
      expectedVersion: investment.version,
      input: { date: '2026-01-02', kind: 'buy', quantity: '2', amount: money(20000n), note: null },
    });
    expect(buy.statusCode).toBe(201);
    investment = buy.json<InvestmentDto>();
    expect(investment.summary.units).toBe('2');
    expect((await request('GET', 'monthly-plans?month=2026-02')).json<MonthlyPlanDto>()).toEqual(
      snapshot,
    );
  });
  it('rejects overselling and cross-user movement changes without advancing the version', async () => {
    const input = {
      date: '2026-01-02',
      kind: 'sell',
      quantity: '3',
      amount: money(30000n),
      note: null,
    };
    expect(
      (
        await request('POST', `investments/${investment.id}/entries`, {
          expectedVersion: investment.version,
          input,
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (await request('GET', `investments/${investment.id}`)).json<InvestmentDto>().version,
    ).toBe(investment.version);
    expect(
      (await request('GET', `investments/${investment.id}/entries`, null, second)).statusCode,
    ).toBe(404);
    const sale = await request('POST', `investments/${investment.id}/entries`, {
      expectedVersion: investment.version,
      input: { ...input, quantity: '1', amount: money(15000n) },
    });
    expect(sale.statusCode).toBe(201);
    investment = sale.json<InvestmentDto>();
    expect(investment.summary.units).toBe('1');
    expect(investment.summary.netCashFlow.minorUnits).toBe('5000');
  });
  it('corrects a same-day purchase atomically and rejects invalid voiding', async () => {
    const rows = (
      await request('GET', `investments/${investment.id}/entries`)
    ).json<MovementsPageDto>().items;
    const buy = rows.find((entry) => entry.kind === 'buy');
    if (!buy) throw new Error('Missing purchase');
    expect(
      (
        await request('POST', `investments/${investment.id}/entries/${buy.id}/void`, {
          expectedVersion: investment.version,
          reason: 'Invalid removal',
        })
      ).statusCode,
    ).toBe(422);
    const corrected = await request(
      'POST',
      `investments/${investment.id}/entries/${buy.id}/correct`,
      {
        expectedVersion: investment.version,
        reason: 'Correct the recorded quantity',
        input: { date: buy.date, kind: 'buy', quantity: '3', amount: money(30000n), note: null },
      },
    );
    expect(corrected.statusCode).toBe(201);
    investment = corrected.json<InvestmentDto>();
    expect(investment.summary.units).toBe('2');
    const history = (
      await request('GET', `investments/${investment.id}/entries`)
    ).json<MovementsPageDto>().items;
    expect(history.find((item) => item.id === buy.id)?.voidedAt).not.toBeNull();
    expect(history.find((item) => item.replacesId === buy.id)?.orderSequence).toBe(
      buy.orderSequence,
    );
    expect(
      (
        await request('POST', `investments/${investment.id}/valuations`, {
          expectedVersion: 1,
          asOf: '2026-01-02',
          amount: money(40000n),
        })
      ).statusCode,
    ).toBe(409);
  });
  it('keeps valuations manual and does not expose a realized-profit result', async () => {
    const response = await request('POST', `investments/${investment.id}/valuations`, {
      expectedVersion: investment.version,
      asOf: '2026-01-02',
      amount: money(40000n),
    });
    expect(response.statusCode).toBe(201);
    investment = response.json<InvestmentDto>();
    expect(investment.latestValuation?.amount.minorUnits).toBe('40000');
    expect(investment.summary).not.toHaveProperty('profit');
    expect(investment.summary).not.toHaveProperty('costBasis');
    expect(
      (
        await request('POST', `investments/${investment.id}/entries`, {
          expectedVersion: investment.version,
          input: {
            date: '2026-01-02',
            kind: 'sell',
            quantity: '1',
            amount: money(100n),
            commission: money(1n),
            note: null,
          },
        })
      ).statusCode,
    ).toBe(422);
  });
});
