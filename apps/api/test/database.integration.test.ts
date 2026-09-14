import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../dist/shared/database.service.js';
import { readEnvironment } from '../dist/shared/environment.js';

const url = process.env['TEST_DATABASE_URL'];
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error(
    'Database integration tests require TEST_DATABASE_URL with a disposable database name ending in _test.',
  );
}
const database = new DatabaseService(readEnvironment({ NODE_ENV: 'test', DATABASE_URL: url }));

beforeAll(async () => {
  await database.ping();
  if ((await database.client.owner.count()) !== 0) {
    throw new Error('The disposable test database must start with an empty owners table.');
  }
});

afterAll(async () => {
  await database.onModuleDestroy();
});

describe('Single-owner persistence foundation', () => {
  it('rolls back an unsuccessful transaction without retaining its owner', async () => {
    const aborted = new Error('Intentional transaction rollback');
    await expect(
      database.client.$transaction(async (transaction) => {
        await transaction.owner.create({ data: {} });
        throw aborted;
      }),
    ).rejects.toThrow(aborted);
    expect(await database.client.owner.count()).toBe(0);
  });

  it('rejects a second owner and rolls back the entire transaction', async () => {
    await expect(
      database.client.$transaction(async (transaction) => {
        await transaction.owner.create({ data: {} });
        await transaction.owner.create({ data: {} });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await database.client.owner.count()).toBe(0);
  });

  it('rejects a false singleton marker at the database boundary', async () => {
    await expect(database.client.owner.create({ data: { singleton: false } })).rejects.toThrow();
    expect(await database.client.owner.count()).toBe(0);
  });
});
