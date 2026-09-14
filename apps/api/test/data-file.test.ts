import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DATA_FORMAT,
  DATA_VERSION,
  documentCounts,
  parseDocument,
} from '../src/modules/data-portability/application/document.js';
import type { FinancialDocument } from '../src/modules/data-portability/application/document.js';
import { validateDocument } from '../src/modules/data-portability/application/validate-document.js';
import { remapData } from '../src/modules/data-portability/application/remap-document.js';

function emptyDocument(): FinancialDocument {
  return {
    format: DATA_FORMAT,
    formatVersion: DATA_VERSION,
    exportedAt: '2026-09-14T12:00:00Z',
    currency: 'EUR',
    moneyEncoding: 'integer-cents-as-strings',
    data: {
      accounts: [],
      spaces: [],
      incomeSources: [],
      incomeRevisions: [],
      commitmentSources: [],
      commitmentRevisions: [],
      commitmentInstallments: [],
      financings: [],
      financingBalances: [],
      investments: [],
      investmentEntries: [],
      investmentValuations: [],
      monthlyPlans: [],
      monthlyPlanRevisions: [],
      financialEvents: [],
    },
  };
}

describe('Financial JSON file contract', () => {
  it('requires the exact supported file version and every collection', () => {
    expect(parseDocument(emptyDocument()).formatVersion).toBe(1);
    expect(() => parseDocument({ ...emptyDocument(), formatVersion: 2 })).toThrow(
      'INCOMPATIBLE_DATA_FILE',
    );
    expect(() => parseDocument({ ...emptyDocument(), data: {} })).toThrow('INVALID_DATA_FILE');
    expect(() => parseDocument({ ...emptyDocument(), credentials: [] })).toThrow(
      'INVALID_DATA_FILE',
    );
  });
  it('rejects dangling account relationships and repeated identifiers', () => {
    const document = emptyDocument();
    document.data.spaces.push({
      id: randomUUID(),
      accountId: randomUUID(),
      name: 'Invalid parent',
      version: 1,
      archivedFromMonth: null,
    });
    expect(() => validateDocument(document, '2026-09-14')).toThrow('INVALID_DATA_FILE');
    const account = {
      id: randomUUID(),
      name: 'Same account',
      currency: 'EUR' as const,
      institution: null,
      reference: null,
      version: 1,
      archivedFromMonth: null,
      createdAt: document.exportedAt,
      updatedAt: document.exportedAt,
    };
    document.data.spaces = [];
    document.data.accounts = [account, { ...account }];
    expect(() => validateDocument(document, '2026-09-14')).toThrow('INVALID_DATA_FILE');
  });
  it('remaps identifiers and links without changing user labels', () => {
    const document = emptyDocument();
    const accountId = randomUUID();
    const spaceId = randomUUID();
    document.data.accounts = [
      {
        id: accountId,
        name: accountId,
        currency: 'EUR',
        institution: null,
        reference: null,
        version: 1,
        archivedFromMonth: null,
        createdAt: document.exportedAt,
        updatedAt: document.exportedAt,
      },
    ];
    document.data.spaces = [
      { id: spaceId, accountId, name: 'Bills', version: 1, archivedFromMonth: null },
    ];
    const copied = remapData(document.data);
    expect(copied.accounts[0]?.id).not.toBe(accountId);
    expect(copied.accounts[0]?.name).toBe(accountId);
    expect(copied.spaces[0]?.accountId).toBe(copied.accounts[0]?.id);
    expect(document.data.accounts[0]?.id).toBe(accountId);
    expect(documentCounts(document).accounts).toBe(1);
  });
});
