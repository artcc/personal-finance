import type { ListInput } from '../../../shared/application/financial-input.js';
import type { DestinationUsage } from '../../../shared/application/destination-usage.js';

export const ACCOUNTS_STORE = Symbol('ACCOUNTS_STORE');
export interface AccountInput {
  name: string;
  institution: string | null;
  reference: string | null;
  currency: 'EUR';
}
export interface AccountRecord extends AccountInput {
  id: string;
  version: number;
  archivedFromMonth: string | null;
  spaceCount: number;
}
export interface SpaceRecord {
  id: string;
  accountId: string;
  name: string;
  version: number;
  archivedFromMonth: string | null;
}
export interface ArchivePreview {
  expectedVersion: number;
  archivedFromMonth: string;
  spaces: SpaceRecord[];
  references: DestinationUsage[];
  referenceCount: number;
}
export interface AccountsStore {
  list(
    userId: string,
    input: ListInput,
    month: string,
  ): Promise<{ items: AccountRecord[]; total: number }>;
  spaces(
    userId: string,
    accountId: string,
    input: ListInput,
    month: string,
  ): Promise<{ items: SpaceRecord[]; total: number }>;
  create(userId: string, input: AccountInput): Promise<AccountRecord>;
  update(
    userId: string,
    id: string,
    input: AccountInput,
    expectedVersion: number,
  ): Promise<AccountRecord>;
  createSpace(userId: string, accountId: string, name: string): Promise<SpaceRecord>;
  updateSpace(
    userId: string,
    id: string,
    name: string,
    expectedVersion: number,
  ): Promise<SpaceRecord>;
  previewArchive(
    userId: string,
    id: string,
    month: string,
    space: boolean,
  ): Promise<ArchivePreview>;
  archive(
    userId: string,
    id: string,
    month: string,
    expectedVersion: number,
    spaceIds: string[],
    space: boolean,
  ): Promise<void>;
}
