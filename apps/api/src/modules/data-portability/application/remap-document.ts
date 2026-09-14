import { randomUUID } from 'node:crypto';
import type { PlanSnapshot } from '../../planning/domain/plan.js';
import type { FinancialData, TableName } from './document.js';
import { tableNames } from './document.js';

// Remap only structural references. User-entered names, notes, and amounts are not rewritten.
export function remapData(original: FinancialData): FinancialData {
  const data = structuredClone(original);
  const maps = new Map<string, Map<string, string>>();
  const id = (table: string, previous: string): string => {
    let map = maps.get(table);
    if (!map) {
      map = new Map();
      maps.set(table, map);
    }
    let value = map.get(previous);
    if (!value) {
      value = randomUUID();
      map.set(previous, value);
    }
    return value;
  };
  for (const table of tableNames) for (const row of data[table]) if ('id' in row) id(table, row.id);
  const destination = <T extends { accountId: string; spaceId: string | null }>(value: T): T => ({
    ...value,
    accountId: id('accounts', value.accountId),
    spaceId: value.spaceId === null ? null : id('spaces', value.spaceId),
  });
  const lineId = (value: string): string =>
    value.startsWith('income:')
      ? `income:${id('incomeSources', value.slice(7))}`
      : value.startsWith('charge:')
        ? `charge:${id('commitmentSources', value.slice(7))}`
        : value;
  const snapshot = (value: PlanSnapshot): PlanSnapshot => ({
    ...value,
    incomes: value.incomes.map((row) => ({
      ...row,
      id: lineId(row.id),
      sourceId: id('incomeSources', row.sourceId),
      sourceRevisionId: id('incomeRevisions', row.sourceRevisionId),
      destination: destination(row.destination),
      sourceInput: {
        ...row.sourceInput,
        destination: destination(
          row.sourceInput.destination as { accountId: string; spaceId: string | null },
        ),
      },
    })),
    charges: value.charges.map((row) => ({
      ...row,
      id: lineId(row.id),
      sourceId: id('commitmentSources', row.sourceId),
      sourceRevisionId: id('commitmentRevisions', row.sourceRevisionId),
      destination: destination(row.destination),
      sourceInput: {
        ...row.sourceInput,
        destination: destination(
          row.sourceInput.destination as { accountId: string; spaceId: string | null },
        ),
      },
    })),
    overrides: value.overrides.map((row) => ({ ...row, lineId: lineId(row.lineId) })),
    allocations: value.allocations.map((row) => ({
      ...row,
      id: id('allocationIdentifiers', row.id),
      sourceLineId: row.sourceLineId === null ? null : lineId(row.sourceLineId),
      destination: destination(row.destination),
    })),
  });
  const eventTables: Record<string, TableName> = {
    account: 'accounts',
    space: 'spaces',
    income: 'incomeSources',
    commitment: 'commitmentSources',
    'monthly-plan': 'monthlyPlans',
    financing: 'financings',
    investment: 'investments',
  };
  const eventPayload = (value: unknown, entityType: string, key = ''): unknown => {
    if (Array.isArray(value)) return value.map((item) => eventPayload(item, entityType, key));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [name, eventPayload(item, entityType, name)]),
      );
    if (typeof value !== 'string') return value;
    if (['lineId', 'discardedOverrides', 'discardOverrideIds'].includes(key)) return lineId(value);
    const table =
      key === 'accountId'
        ? 'accounts'
        : key === 'spaceId' || key === 'spaceIds'
          ? 'spaces'
          : key === 'planningSourceId'
            ? 'commitmentSources'
            : key === 'entryId' || key === 'previousId'
              ? 'investmentEntries'
              : key === 'reportId'
                ? 'financingBalances'
                : key === 'valuationId'
                  ? 'investmentValuations'
                  : key === 'revisionId'
                    ? entityType === 'income'
                      ? 'incomeRevisions'
                      : entityType === 'commitment'
                        ? 'commitmentRevisions'
                        : null
                    : key === 'id'
                      ? eventTables[entityType]
                      : null;
    return table && /^[0-9a-f-]{36}$/i.test(value) ? id(table, value) : value;
  };
  data.accounts = data.accounts.map((row) => ({ ...row, id: id('accounts', row.id) }));
  data.spaces = data.spaces.map((row) => ({
    ...row,
    id: id('spaces', row.id),
    accountId: id('accounts', row.accountId),
  }));
  data.incomeSources = data.incomeSources.map((row) => ({
    ...row,
    id: id('incomeSources', row.id),
  }));
  data.incomeRevisions = data.incomeRevisions.map((row) => ({
    ...row,
    id: id('incomeRevisions', row.id),
    sourceId: id('incomeSources', row.sourceId),
    ...destination({ accountId: row.accountId, spaceId: row.spaceId }),
    input: { ...row.input, destination: destination(row.input.destination) },
  }));
  data.commitmentSources = data.commitmentSources.map((row) => ({
    ...row,
    id: id('commitmentSources', row.id),
  }));
  data.commitmentRevisions = data.commitmentRevisions.map((row) => ({
    ...row,
    id: id('commitmentRevisions', row.id),
    sourceId: id('commitmentSources', row.sourceId),
    ...destination({ accountId: row.accountId, spaceId: row.spaceId }),
    input: { ...row.input, destination: destination(row.input.destination) },
  }));
  data.commitmentInstallments = data.commitmentInstallments.map((row) => ({
    ...row,
    revisionId: id('commitmentRevisions', row.revisionId),
  }));
  data.financings = data.financings.map((row) => ({
    ...row,
    id: id('financings', row.id),
    planningSourceId: id('commitmentSources', row.planningSourceId),
  }));
  data.financingBalances = data.financingBalances.map((row) => ({
    ...row,
    id: id('financingBalances', row.id),
    financingId: id('financings', row.financingId),
  }));
  data.investments = data.investments.map((row) => ({
    ...row,
    id: id('investments', row.id),
    planningSourceId:
      row.planningSourceId === null ? null : id('commitmentSources', row.planningSourceId),
  }));
  data.investmentEntries = data.investmentEntries.map((row) => ({
    ...row,
    id: id('investmentEntries', row.id),
    investmentId: id('investments', row.investmentId),
    replacesId: row.replacesId === null ? null : id('investmentEntries', row.replacesId),
  }));
  data.investmentValuations = data.investmentValuations.map((row) => ({
    ...row,
    id: id('investmentValuations', row.id),
    investmentId: id('investments', row.investmentId),
  }));
  data.monthlyPlans = data.monthlyPlans.map((row) => ({ ...row, id: id('monthlyPlans', row.id) }));
  data.monthlyPlanRevisions = data.monthlyPlanRevisions.map((row) => ({
    ...row,
    id: id('monthlyPlanRevisions', row.id),
    planId: id('monthlyPlans', row.planId),
    snapshot: snapshot(row.snapshot),
  }));
  data.financialEvents = data.financialEvents.map((row) => ({
    ...row,
    id: id('financialEvents', row.id),
    entityId: id(eventTables[row.entityType] ?? 'historicalEntities', row.entityId),
    payload: eventPayload(row.payload, row.entityType) as Record<string, unknown>,
  }));
  return data;
}
