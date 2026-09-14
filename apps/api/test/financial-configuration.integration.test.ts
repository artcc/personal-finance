import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/bootstrap.js';
import { readEnvironment } from '../dist/shared/environment.js';
import { DatabaseService } from '../dist/shared/database.service.js';
import type { CurrentSessionDto } from '../dist/modules/identity/http/auth.dto.js';
import type {
  AccountDto,
  AccountsPageDto,
  ArchivePreviewDto,
  SpaceDto,
} from '../dist/modules/accounts/http/accounts.dto.js';
import type {
  IncomeRecordDto,
  IncomePageDto,
  IncomeDetailDto,
} from '../dist/modules/income/http/income.dto.js';
import type { CommitmentRecordDto } from '../dist/modules/commitments/http/commitments.dto.js';
import type { IncomeDefinition } from '../src/modules/income/domain/income.js';
import type { CommitmentDefinition } from '../src/modules/commitments/domain/commitment.js';
import { money } from '../src/shared/domain/money.js';

const url = process.env['TEST_DATABASE_URL'];
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error(
    'Financial integration tests require a disposable TEST_DATABASE_URL ending in _test.',
  );
const origin = 'http://127.0.0.1:4173';
type Actor = {
  session: CurrentSessionDto;
  headers: { cookie: string; origin: string; 'x-csrf-token': string };
};
let running: Awaited<ReturnType<typeof createApplication>>;
let first: Actor;
let second: Actor;
let account: AccountDto;
let alternative: AccountDto;
let foreign: AccountDto;
let space: SpaceDto;
let income: IncomeRecordDto;
let commitment: CommitmentRecordDto;
let incomeInput: IncomeDefinition;
let commitmentInput: CommitmentDefinition;

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
        displayName: 'Financial test user',
        password: 'A financial fixture password 42',
      },
    });
    expect(response.statusCode).toBe(201);
    const session = response.json<CurrentSessionDto>();
    const raw = response.headers['set-cookie'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header) throw new Error('Missing fixture cookie');
    return {
      session,
      headers: { origin, cookie: header.split(';')[0] ?? '', 'x-csrf-token': session.csrfToken },
    };
  };
  first = await register();
  second = await register();
  const create = async (name: string, actor: Actor) => {
    const response = await request(
      'POST',
      'accounts',
      { name, institution: null, reference: null, currency: 'EUR' },
      actor,
    );
    expect(response.statusCode).toBe(201);
    return response.json<AccountDto>();
  };
  account = await create('Main account', first);
  alternative = await create('Alternative account', first);
  foreign = await create('Other private account', second);
  const response = await request('POST', `accounts/${account.id}/spaces`, { name: 'Bills' });
  expect(response.statusCode).toBe(201);
  space = response.json<SpaceDto>();
  incomeInput = {
    name: 'Consulting',
    effectiveFromMonth: '2026-01',
    startsOn: '2026-01-01',
    endsOn: null,
    destination: { accountId: account.id, spaceId: null },
    kind: 'professional',
    netSalary: null,
    base: money(100000n),
    hourlyRate: null,
    hours: null,
    vatRate: '0.21',
    withholdingRate: '0.15',
    commissionRate: '0.10',
  };
  commitmentInput = {
    name: 'Annual insurance',
    effectiveFromMonth: '2026-01',
    startsOn: '2026-01-01',
    endsOn: null,
    destination: { accountId: account.id, spaceId: space.id },
    kind: 'fixed',
    frequency: 'annual',
    amount: money(10000n),
    dueDay: null,
    installments: [
      { month: 5, day: 20, amount: money(4000n) },
      { month: 11, day: 20, amount: money(6000n) },
    ],
  };
}, 30_000);

afterAll(async () => {
  await running?.app.close();
});

describe('User-scoped financial configuration and transactions', () => {
  it('keeps account and space access private to their owner', async () => {
    const list = await request('GET', 'accounts?includeArchived=true', null, second);
    expect(list.json<AccountsPageDto>().items.map((item) => item.id)).toEqual([foreign.id]);
    expect((await request('GET', `accounts/${account.id}/spaces`, null, second)).statusCode).toBe(
      404,
    );
    expect(
      (
        await request(
          'PATCH',
          `spaces/${space.id}`,
          { name: 'Unauthorized', expectedVersion: 1 },
          second,
        )
      ).statusCode,
    ).toBe(404);
    const database = running.app.get(DatabaseService);
    await expect(
      database.client.space.create({
        data: {
          accountId: account.id,
          userId: second.session.user.id,
          name: 'Invalid relationship',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects a foreign destination without creating a source or audit event', async () => {
    const database = running.app.get(DatabaseService);
    const before = await database.client.financialEvent.count({
      where: { userId: first.session.user.id },
    });
    const response = await request('POST', 'income-sources', {
      input: { ...incomeInput, destination: { accountId: foreign.id, spaceId: null } },
    });
    expect(response.statusCode).toBe(404);
    expect(
      await database.client.incomeSource.count({ where: { userId: first.session.user.id } }),
    ).toBe(0);
    expect(
      await database.client.financialEvent.count({ where: { userId: first.session.user.id } }),
    ).toBe(before);
  });

  it('persists exact income components and immutable effective-month revisions', async () => {
    const created = await request('POST', 'income-sources', { input: incomeInput });
    expect(created.statusCode).toBe(201);
    income = created.json<IncomeRecordDto>();
    expect(income.revision.calculation.expectedCash.minorUnits).toBe('96000');
    expect(income.revision.calculation.taxReserve.minorUnits).toBe('21000');
    incomeInput = {
      ...incomeInput,
      name: 'Teaching',
      effectiveFromMonth: '2026-05',
      base: money(200000n),
    };
    const changed = await request('POST', `income-sources/${income.id}/revisions`, {
      expectedVersion: income.version,
      input: incomeInput,
    });
    expect(changed.statusCode).toBe(201);
    income = changed.json<IncomeRecordDto>();
    const april = (
      await request('GET', 'income-sources?month=2026-04&q=Consulting')
    ).json<IncomePageDto>();
    expect(april.items[0]?.calculation.expectedCash.minorUnits).toBe('96000');
    const may = (
      await request('GET', 'income-sources?month=2026-05&q=Teaching')
    ).json<IncomePageDto>();
    expect(may.items[0]?.calculation.expectedCash.minorUnits).toBe('192000');
    expect(
      (await request('GET', 'income-sources?month=2026-05&q=Consulting')).json<IncomePageDto>()
        .total,
    ).toBe(0);
    expect(
      (await request('GET', 'income-sources?month=2026-05&kind=salary')).json<IncomePageDto>()
        .total,
    ).toBe(0);
    expect(
      (await request('GET', `income-sources/${income.id}`)).json<IncomeDetailDto>().history,
    ).toHaveLength(2);
    expect(
      (
        await request('POST', `income-sources/${income.id}/revisions`, {
          expectedVersion: 1,
          input: incomeInput,
        })
      ).statusCode,
    ).toBe(409);
    expect((await request('GET', `income-sources/${income.id}`, null, second)).statusCode).toBe(
      404,
    );
  });

  it('keeps a one-month entry out of later months and recurring sources', async () => {
    const response = await request('POST', 'income-entries', {
      input: {
        ...incomeInput,
        name: 'One-month bonus',
        kind: 'salary',
        effectiveFromMonth: '2026-04',
        startsOn: '2026-04-10',
        netSalary: money(50000n),
        base: null,
        vatRate: '0',
        withholdingRate: '0',
        commissionRate: '0',
      },
    });
    expect(response.statusCode).toBe(201);
    const entry = response.json<IncomeRecordDto>();
    expect(
      (await request('GET', 'income-entries?month=2026-04'))
        .json<IncomePageDto>()
        .items.map((item) => item.id),
    ).toContain(entry.id);
    expect(
      (await request('GET', 'income-entries?month=2026-05')).json<IncomePageDto>().items,
    ).toHaveLength(0);
    expect(
      (await request('GET', 'income-sources?month=2026-04'))
        .json<IncomePageDto>()
        .items.map((item) => item.id),
    ).not.toContain(entry.id);
  });

  it('checks installment totals and keeps previews side-effect free', async () => {
    const database = running.app.get(DatabaseService);
    const invalid = await request('POST', 'commitments', {
      input: { ...commitmentInput, amount: money(11000n) },
    });
    expect(invalid.statusCode).toBe(422);
    expect(
      await database.client.commitmentSource.count({ where: { userId: first.session.user.id } }),
    ).toBe(0);
    const before = await database.client.financialEvent.count({
      where: { userId: first.session.user.id },
    });
    const preview = await request('POST', 'commitments/preview', {
      input: commitmentInput,
      month: '2026-11',
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      monthlyCharge: { minorUnits: '833' },
      duePayments: [{ date: '2026-11-20', amount: { minorUnits: '6000' } }],
    });
    expect(
      await database.client.financialEvent.count({ where: { userId: first.session.user.id } }),
    ).toBe(before);
    const created = await request('POST', 'commitments', { input: commitmentInput });
    expect(created.statusCode).toBe(201);
    commitment = created.json<CommitmentRecordDto>();
  });

  it('requires future references to be reassigned before archiving their account and spaces', async () => {
    const firstPreview = (
      await request('POST', `accounts/${account.id}/archive-preview`, {
        archivedFromMonth: '2026-05',
      })
    ).json<ArchivePreviewDto>();
    expect(firstPreview.referenceCount).toBe(2);
    expect(
      (
        await request('POST', `accounts/${account.id}/archive`, {
          expectedVersion: firstPreview.expectedVersion,
          archivedFromMonth: '2026-05',
          spaceIds: firstPreview.spaceIds,
        })
      ).statusCode,
    ).toBe(409);
    incomeInput = { ...incomeInput, destination: { accountId: alternative.id, spaceId: null } };
    expect(
      (
        await request('POST', `income-sources/${income.id}/revisions`, {
          expectedVersion: income.version,
          input: incomeInput,
        })
      ).statusCode,
    ).toBe(201);
    commitmentInput = {
      ...commitmentInput,
      effectiveFromMonth: '2026-05',
      destination: { accountId: alternative.id, spaceId: null },
    };
    expect(
      (
        await request('POST', `commitments/${commitment.id}/revisions`, {
          expectedVersion: commitment.version,
          input: commitmentInput,
        })
      ).statusCode,
    ).toBe(201);
    const reviewed = (
      await request('POST', `accounts/${account.id}/archive-preview`, {
        archivedFromMonth: '2026-05',
      })
    ).json<ArchivePreviewDto>();
    expect(reviewed.referenceCount).toBe(0);
    expect(
      (
        await request('POST', `accounts/${account.id}/archive`, {
          expectedVersion: reviewed.expectedVersion,
          archivedFromMonth: '2026-05',
          spaceIds: reviewed.spaceIds,
        })
      ).statusCode,
    ).toBe(204);
    const database = running.app.get(DatabaseService);
    expect(
      (await database.client.space.findUniqueOrThrow({ where: { id: space.id } }))
        .archivedFromMonth,
    ).toBe('2026-05');
    expect(
      (await request('GET', 'accounts?month=2026-04'))
        .json<AccountsPageDto>()
        .items.map((item) => item.id),
    ).toContain(account.id);
    expect(
      (await request('GET', 'accounts?month=2026-05'))
        .json<AccountsPageDto>()
        .items.map((item) => item.id),
    ).not.toContain(account.id);
  });

  it('rejects stale concurrent account edits and records only the successful change', async () => {
    const responses = await Promise.all(
      ['Reserve one', 'Reserve two'].map((name) =>
        request('PATCH', `accounts/${alternative.id}`, {
          expectedVersion: alternative.version,
          name,
          currency: 'EUR',
          institution: null,
          reference: null,
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(
      await running.app
        .get(DatabaseService)
        .client.financialEvent.count({ where: { entityId: alternative.id, action: 'updated' } }),
    ).toBe(1);
  });
});
