import { Inject, Injectable } from '@nestjs/common';
import type { Account, Space } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../shared/database.service.js';
import { FinancialError } from '../../../shared/domain/financial-error.js';
import {
  destinationUsage,
  financialEvent,
  financialWrite,
} from '../../../shared/infrastructure/financial-write.js';
import type { FinancialTransaction } from '../../../shared/infrastructure/financial-write.js';
import type { ListInput } from '../../../shared/application/financial-input.js';
import type {
  AccountInput,
  AccountRecord,
  AccountsStore,
  ArchivePreview,
  SpaceRecord,
} from '../application/accounts.port.js';

function accountRecord(account: Account & { _count: { spaces: number } }): AccountRecord {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    reference: account.reference,
    currency: 'EUR',
    version: account.version,
    archivedFromMonth: account.archivedFromMonth,
    spaceCount: account._count.spaces,
  };
}
function spaceRecord(space: Space): SpaceRecord {
  return {
    id: space.id,
    accountId: space.accountId,
    name: space.name,
    version: space.version,
    archivedFromMonth: space.archivedFromMonth,
  };
}
async function ownedAccount(transaction: FinancialTransaction, userId: string, id: string) {
  const record = await transaction.account.findFirst({
    where: { id, userId },
    include: { _count: { select: { spaces: true } } },
  });
  if (!record) throw new FinancialError('ACCOUNT_NOT_FOUND');
  return record;
}
async function archivePreview(
  transaction: FinancialTransaction,
  userId: string,
  id: string,
  month: string,
  isSpace: boolean,
): Promise<ArchivePreview> {
  const space = isSpace ? await transaction.space.findFirst({ where: { id, userId } }) : null;
  if (isSpace && !space) throw new FinancialError('SPACE_NOT_FOUND');
  const account = await ownedAccount(transaction, userId, space?.accountId ?? id);
  const spaces = isSpace
    ? []
    : await transaction.space.findMany({
        where: {
          userId,
          accountId: account.id,
          OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }],
        },
        orderBy: { id: 'asc' },
      });
  const references = await destinationUsage(
    transaction,
    userId,
    account.id,
    space?.id ?? null,
    month,
  );
  return {
    expectedVersion: space?.version ?? account.version,
    archivedFromMonth: month,
    spaces: spaces.map(spaceRecord),
    references: references.slice(0, 20),
    referenceCount: references.length,
  };
}

@Injectable()
export class PrismaAccountsStore implements AccountsStore {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(userId: string, input: ListInput, month: string) {
    const where = {
      userId,
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: 'insensitive' as const } },
              { institution: { contains: input.q, mode: 'insensitive' as const } },
              { reference: { contains: input.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(!input.includeArchived
        ? { AND: [{ OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] }] }
        : {}),
    };
    const [accounts, total] = await this.database.client.$transaction([
      this.database.client.account.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { spaces: true } } },
      }),
      this.database.client.account.count({ where }),
    ]);
    return { items: accounts.map(accountRecord), total };
  }

  async spaces(userId: string, accountId: string, input: ListInput, month: string) {
    await ownedAccount(this.database.client, userId, accountId);
    const where = {
      userId,
      accountId,
      ...(input.q ? { name: { contains: input.q, mode: 'insensitive' as const } } : {}),
      ...(!input.includeArchived
        ? { OR: [{ archivedFromMonth: null }, { archivedFromMonth: { gt: month } }] }
        : {}),
    };
    const [items, total] = await this.database.client.$transaction([
      this.database.client.space.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.database.client.space.count({ where }),
    ]);
    return { items: items.map(spaceRecord), total };
  }

  create(userId: string, input: AccountInput): Promise<AccountRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const record = await transaction.account.create({
        data: { userId, ...input },
        include: { _count: { select: { spaces: true } } },
      });
      await financialEvent(transaction, userId, 'account', record.id, 'created', input);
      return accountRecord(record);
    });
  }

  update(
    userId: string,
    id: string,
    input: AccountInput,
    expectedVersion: number,
  ): Promise<AccountRecord> {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await ownedAccount(transaction, userId, id);
      if (previous.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (previous.archivedFromMonth) throw new FinancialError('RESOURCE_ARCHIVED');
      const record = await transaction.account.update({
        where: { id, userId },
        data: { ...input, version: { increment: 1 } },
        include: { _count: { select: { spaces: true } } },
      });
      await financialEvent(transaction, userId, 'account', id, 'updated', {
        before: accountRecord(previous),
        after: accountRecord(record),
      });
      return accountRecord(record);
    });
  }

  createSpace(userId: string, accountId: string, name: string) {
    return financialWrite(this.database, userId, async (transaction) => {
      const account = await ownedAccount(transaction, userId, accountId);
      if (account.archivedFromMonth) throw new FinancialError('RESOURCE_ARCHIVED');
      if (account._count.spaces >= 100) throw new FinancialError('INVALID_FINANCIAL_INPUT');
      const record = await transaction.space.create({ data: { userId, accountId, name } });
      await transaction.account.update({
        where: { id: accountId, userId },
        data: { version: { increment: 1 } },
      });
      await financialEvent(transaction, userId, 'space', record.id, 'created', { accountId, name });
      return spaceRecord(record);
    });
  }

  updateSpace(userId: string, id: string, name: string, expectedVersion: number) {
    return financialWrite(this.database, userId, async (transaction) => {
      const previous = await transaction.space.findFirst({ where: { id, userId } });
      if (!previous) throw new FinancialError('SPACE_NOT_FOUND');
      const account = await ownedAccount(transaction, userId, previous.accountId);
      if (previous.version !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (previous.archivedFromMonth || account.archivedFromMonth)
        throw new FinancialError('RESOURCE_ARCHIVED');
      const record = await transaction.space.update({
        where: { id, userId },
        data: { name, version: { increment: 1 } },
      });
      await transaction.account.update({
        where: { id: account.id, userId },
        data: { version: { increment: 1 } },
      });
      await financialEvent(transaction, userId, 'space', id, 'updated', {
        before: previous.name,
        after: name,
      });
      return spaceRecord(record);
    });
  }

  previewArchive(
    userId: string,
    id: string,
    month: string,
    space: boolean,
  ): Promise<ArchivePreview> {
    return this.database.client.$transaction(
      (transaction) => archivePreview(transaction, userId, id, month, space),
      { isolationLevel: 'RepeatableRead' },
    );
  }

  archive(
    userId: string,
    id: string,
    month: string,
    expectedVersion: number,
    spaceIds: string[],
    isSpace: boolean,
  ): Promise<void> {
    return financialWrite(this.database, userId, async (transaction) => {
      const preview = await archivePreview(transaction, userId, id, month, isSpace);
      if (preview.expectedVersion !== expectedVersion) throw new FinancialError('VERSION_CONFLICT');
      if (preview.referenceCount > 0) throw new FinancialError('DESTINATION_IN_USE');
      if (
        new Set(spaceIds).size !== spaceIds.length ||
        preview.spaces.length !== spaceIds.length ||
        preview.spaces.some((space) => !spaceIds.includes(space.id))
      )
        throw new FinancialError('ARCHIVE_PREVIEW_CONFLICT');
      if (isSpace) {
        const previous = await transaction.space.findFirstOrThrow({ where: { id, userId } });
        if (previous.archivedFromMonth) throw new FinancialError('RESOURCE_ARCHIVED');
        await transaction.space.update({
          where: { id, userId },
          data: { archivedFromMonth: month, version: { increment: 1 } },
        });
        await transaction.account.update({
          where: { id: previous.accountId, userId },
          data: { version: { increment: 1 } },
        });
      } else {
        const account = await ownedAccount(transaction, userId, id);
        if (account.archivedFromMonth) throw new FinancialError('RESOURCE_ARCHIVED');
        await transaction.account.update({
          where: { id, userId },
          data: { archivedFromMonth: month, version: { increment: 1 } },
        });
        await transaction.space.updateMany({
          where: { userId, accountId: id, id: { in: spaceIds } },
          data: { archivedFromMonth: month, version: { increment: 1 } },
        });
      }
      await financialEvent(transaction, userId, isSpace ? 'space' : 'account', id, 'archived', {
        month,
        spaceIds,
        expectedVersion,
      });
    });
  }
}
