import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/bootstrap.js';
import { readEnvironment } from '../dist/shared/environment.js';
import { DatabaseService } from '../dist/shared/database.service.js';
import type { CurrentSessionDto } from '../dist/modules/identity/http/auth.dto.js';
import type { AccountDto } from '../dist/modules/accounts/http/accounts.dto.js';
import type { CommitmentRecordDto } from '../dist/modules/commitments/http/commitments.dto.js';
import type {
  MonthlyPlanDto,
  PlanRefreshPreviewDto,
} from '../dist/modules/planning/http/planning.dto.js';
import { money } from '../src/shared/domain/money.js';

const url = process.env['TEST_DATABASE_URL'];
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Planning tests require a disposable TEST_DATABASE_URL ending in _test.');
const origin = 'http://127.0.0.1:4173';
type Actor = { id: string; headers: { origin: string; cookie: string; 'x-csrf-token': string } };
let running: Awaited<ReturnType<typeof createApplication>>;
let first: Actor;
let second: Actor;
let account: AccountDto;
let foreign: AccountDto;
let cost: CommitmentRecordDto;
let plan: MonthlyPlanDto;

async function request(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: object | null = null,
  actor = first,
) {
  return running.app.inject({
    method,
    url: `/api/v1/${path}`,
    headers: actor.headers,
    ...(body === null ? {} : { payload: body }),
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
        displayName: 'Planning user',
        password: 'A planning fixture password 42',
      },
    });
    expect(response.statusCode).toBe(201);
    const data = response.json<CurrentSessionDto>();
    const header = response.headers['set-cookie'];
    const cookie = Array.isArray(header) ? header[0] : header;
    if (!cookie) throw new Error('Missing cookie');
    return {
      id: data.user.id,
      headers: { origin, cookie: cookie.split(';')[0] ?? '', 'x-csrf-token': data.csrfToken },
    };
  };
  first = await register();
  second = await register();
  const createAccount = async (actor: Actor) => {
    const result = await request(
      'POST',
      'accounts',
      { name: 'Planning bank', institution: null, reference: null, currency: 'EUR' },
      actor,
    );
    expect(result.statusCode).toBe(201);
    return result.json<AccountDto>();
  };
  account = await createAccount(first);
  foreign = await createAccount(second);
  const common = {
    effectiveFromMonth: '2026-01',
    startsOn: '2026-01-01',
    endsOn: null,
    destination: { accountId: account.id, spaceId: null },
  };
  expect(
    (
      await request('POST', 'income-sources', {
        input: {
          ...common,
          name: 'Salary',
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
  const created = await request('POST', 'commitments', {
    input: {
      ...common,
      name: 'Monthly costs',
      kind: 'fixed',
      frequency: 'monthly',
      amount: money(110000n),
      dueDay: 20,
      installments: [],
    },
  });
  expect(created.statusCode).toBe(201);
  cost = created.json<CommitmentRecordDto>();
}, 30_000);
afterAll(async () => {
  await running?.app.close();
});

describe('Transactional monthly planning', () => {
  it('generates one identity under concurrent requests and preserves it on retries', async () => {
    const results = await Promise.all([
      request('POST', 'monthly-plans', { month: '2026-10' }),
      request('POST', 'monthly-plans', { month: '2026-10' }),
    ]);
    expect(results.map((result) => result.statusCode)).toEqual([200, 200]);
    plan = results[0]!.json<MonthlyPlanDto>();
    expect(results[1]!.json<MonthlyPlanDto>().id).toBe(plan.id);
    expect(plan.summary.plannedAvailability.minorUnits).toBe('90000');
    expect(
      await running.app
        .get(DatabaseService)
        .client.monthlyPlan.count({ where: { userId: first.id, month: '2026-10' } }),
    ).toBe(1);
    expect(
      await running.app
        .get(DatabaseService)
        .client.financialEvent.count({ where: { entityId: plan.id, action: 'generated' } }),
    ).toBe(1);
  });
  it('protects plans, histories, and destination relationships across users', async () => {
    expect(
      (await request('GET', `monthly-plans/${plan.id}/revisions`, null, second)).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          'POST',
          `monthly-plans/${plan.id}/close`,
          { expectedVersion: plan.version, acknowledgeShortfall: false },
          second,
        )
      ).statusCode,
    ).toBe(404);
    const invalid = await request('PUT', `monthly-plans/${plan.id}/allocations`, {
      expectedVersion: plan.version,
      allocations: [
        {
          id: 'foreign',
          purpose: 'remaining',
          sourceLineId: null,
          amount: money(200000n),
          remainder: false,
          destination: { accountId: foreign.id, spaceId: null },
        },
      ],
    });
    expect(invalid.statusCode).toBe(422);
    expect(
      (await request('GET', 'monthly-plans?month=2026-10')).json<MonthlyPlanDto>().version,
    ).toBe(plan.version);
  });
  it('keeps monthly overrides on repeated generation and on compatible refresh', async () => {
    const line = plan.charges[0];
    if (!line) throw new Error('Missing charge');
    const adjusted = await request('PUT', `monthly-plans/${plan.id}/overrides/${line.id}`, {
      expectedVersion: plan.version,
      amount: money(100000n),
      taxReserve: null,
      reason: 'Monthly exception',
    });
    expect(adjusted.statusCode).toBe(200);
    plan = adjusted.json<MonthlyPlanDto>();
    expect(
      (await request('POST', 'monthly-plans', { month: '2026-10' })).json<MonthlyPlanDto>()
        .charges[0]?.amount.minorUnits,
    ).toBe('100000');
    const preview = (
      await request('POST', `monthly-plans/${plan.id}/refresh-preview`, {
        expectedVersion: plan.version,
      })
    ).json<PlanRefreshPreviewDto>();
    expect(preview.changed).toHaveLength(0);
    const updated = await request('POST', `monthly-plans/${plan.id}/refresh`, {
      expectedVersion: plan.version,
      inputFingerprint: preview.inputFingerprint,
      discardOverrideIds: [],
      resetAllocations: false,
    });
    expect(updated.statusCode).toBe(200);
    plan = updated.json<MonthlyPlanDto>();
    expect(plan.charges[0]?.overrideReason).toBe('Monthly exception');
    const restored = await request('DELETE', `monthly-plans/${plan.id}/overrides/${line.id}`, {
      expectedVersion: plan.version,
      reason: 'Use the original amount',
    });
    expect(restored.statusCode).toBe(200);
    plan = restored.json<MonthlyPlanDto>();
    expect(plan.summary.plannedAvailability.minorUnits).toBe('90000');
  });
  it('reconciles allocations without a duplicate everyday-spending charge and closes atomically', async () => {
    expect(
      (
        await request('POST', `monthly-plans/${plan.id}/close`, {
          expectedVersion: plan.version,
          acknowledgeShortfall: true,
        })
      ).statusCode,
    ).toBe(422);
    const allocations = [
      ...plan.allocations.map((row) => ({
        id: row.id,
        destination: { accountId: row.destination.accountId, spaceId: row.destination.spaceId },
        purpose: row.purpose,
        sourceLineId: row.sourceLineId,
        amount: row.amount,
        remainder: row.remainder,
      })),
      {
        id: 'daily',
        destination: { accountId: account.id, spaceId: null },
        purpose: 'everyday',
        sourceLineId: null,
        amount: money(60000n),
        remainder: false,
      },
      {
        id: 'rest',
        destination: { accountId: account.id, spaceId: null },
        purpose: 'remaining',
        sourceLineId: null,
        amount: money(0n),
        remainder: true,
      },
    ];
    const saved = await request('PUT', `monthly-plans/${plan.id}/allocations`, {
      expectedVersion: plan.version,
      allocations,
    });
    expect(saved.statusCode).toBe(200);
    plan = saved.json<MonthlyPlanDto>();
    expect(plan.summary.unallocatedCash.minorUnits).toBe('0');
    expect(plan.summary.remainingAvailability.minorUnits).toBe('30000');
    const results = await Promise.all([
      request('POST', `monthly-plans/${plan.id}/close`, {
        expectedVersion: plan.version,
        acknowledgeShortfall: false,
      }),
      request('POST', `monthly-plans/${plan.id}/close`, {
        expectedVersion: plan.version,
        acknowledgeShortfall: false,
      }),
    ]);
    expect(results.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const closed = results.find((response) => response.statusCode === 200);
    if (!closed) throw new Error('Missing close result');
    plan = closed.json<MonthlyPlanDto>();
  });
  it('preserves closed data after source edits and rejects in-place closed-row updates', async () => {
    const original = plan;
    const changed = await request('POST', `commitments/${cost.id}/revisions`, {
      expectedVersion: cost.version,
      input: {
        ...cost.revision.input,
        effectiveFromMonth: '2026-10',
        amount: money(150000n),
        name: 'Changed cost',
      },
    });
    expect(changed.statusCode).toBe(201);
    cost = changed.json<CommitmentRecordDto>();
    expect((await request('GET', 'monthly-plans?month=2026-10')).json<MonthlyPlanDto>()).toEqual(
      original,
    );
    const database = running.app.get(DatabaseService);
    await expect(
      database.client.monthlyPlanRevision.update({
        where: { planId_number: { planId: plan.id, number: 1 } },
        data: { availabilityCents: 0n },
      }),
    ).rejects.toThrow();
    const reopened = await request('POST', `monthly-plans/${plan.id}/reopen`, {
      expectedVersion: plan.version,
      reason: 'Review source changes',
    });
    expect(reopened.statusCode).toBe(200);
    plan = reopened.json<MonthlyPlanDto>();
    expect(plan.revision).toBe(2);
    expect(plan.version).toBeGreaterThan(original.version);
    const previous = (
      await request('GET', `monthly-plans/${plan.id}/revisions/1`)
    ).json<MonthlyPlanDto>();
    expect(previous.summary).toEqual(original.summary);
    expect(previous.state).toBe('closed');
    expect(
      (
        await request('POST', `monthly-plans/${plan.id}/close`, {
          expectedVersion: original.version,
          acknowledgeShortfall: true,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('rejects a refresh when configuration changes after preview', async () => {
    const preview = (
      await request('POST', `monthly-plans/${plan.id}/refresh-preview`, {
        expectedVersion: plan.version,
      })
    ).json<PlanRefreshPreviewDto>();
    const changed = await request('POST', `commitments/${cost.id}/revisions`, {
      expectedVersion: cost.version,
      input: { ...cost.revision.input, amount: money(160000n) },
    });
    expect(changed.statusCode).toBe(201);
    const response = await request('POST', `monthly-plans/${plan.id}/refresh`, {
      expectedVersion: plan.version,
      inputFingerprint: preview.inputFingerprint,
      discardOverrideIds: [],
      resetAllocations: true,
    });
    expect(response.statusCode).toBe(409);
    expect(
      (await request('GET', 'monthly-plans?month=2026-10')).json<MonthlyPlanDto>().version,
    ).toBe(plan.version);
  });
});
