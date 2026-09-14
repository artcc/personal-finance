import { Inject, Injectable } from '@nestjs/common';
import { FinancialClock } from '../../../shared/application/financial-clock.js';
import { DATA_STORE } from './data.port.js';
import type { DataStore } from './data.port.js';
import { DataFileError, documentCounts, fingerprint, parseDocument } from './document.js';
import { validateDocument } from './validate-document.js';

@Injectable()
export class DataService {
  constructor(
    @Inject(DATA_STORE) private readonly store: DataStore,
    @Inject(FinancialClock) private readonly clock: FinancialClock,
  ) {}
  export(userId: string) {
    return this.store.export(userId);
  }
  async preview(userId: string, value: unknown) {
    const document = parseDocument(value);
    validateDocument(document, this.clock.context().today);
    const counts = documentCounts(document);
    return {
      formatVersion: document.formatVersion,
      exportedAt: document.exportedAt,
      fingerprint: fingerprint(document),
      counts,
      totalRecords: Object.values(counts).reduce((sum, count) => sum + count, 0),
      canImport: await this.store.isEmpty(userId),
    };
  }
  async import(userId: string, value: unknown, expectedFingerprint: string) {
    const document = parseDocument(value);
    validateDocument(document, this.clock.context().today);
    const digest = fingerprint(document);
    if (digest !== expectedFingerprint) throw new DataFileError('IMPORT_PREVIEW_CHANGED');
    await this.store.import(userId, document, digest);
    return {
      counts: documentCounts(document),
      totalRecords: Object.values(documentCounts(document)).reduce((sum, count) => sum + count, 0),
    };
  }
}
