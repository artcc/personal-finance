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
});

afterAll(async () => {
  await database.onModuleDestroy();
});

describe('Independent-user persistence foundation', () => {
  it('rolls back an unsuccessful transaction without retaining its user', async () => {
    const before = await database.client.user.count();
    const aborted = new Error('Intentional transaction rollback');
    await expect(
      database.client.$transaction(async (transaction) => {
        await transaction.user.create({ data: {} });
        throw aborted;
      }),
    ).rejects.toThrow(aborted);
    expect(await database.client.user.count()).toBe(before);
  });

  it('permits two independent users without the old singleton restriction', async () => {
    const before = await database.client.user.count();
    const aborted = new Error('Roll back the test fixture');
    await expect(
      database.client.$transaction(async (transaction) => {
        const first = await transaction.user.create({ data: {} });
        const second = await transaction.user.create({ data: {} });
        expect(first.id).not.toBe(second.id);
        expect(await transaction.user.count()).toBe(before + 2);
        throw aborted;
      }),
    ).rejects.toThrow(aborted);
    expect(await database.client.user.count()).toBe(before);
  });
});
