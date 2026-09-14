import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ clientAddress: void }>({
  clientAddress: [
    async ({ context }, use, testInfo) => {
      // Each worker represents a distinct client behind the explicitly trusted CI proxy.
      // Production throttling and the API limiter tests keep their normal configuration.
      const address = `198.18.${Math.floor(testInfo.workerIndex / 250)}.${(testInfo.workerIndex % 250) + 1}`;
      await context.setExtraHTTPHeaders({ 'X-Forwarded-For': address });
      await use();
    },
    { auto: true },
  ],
});
export { expect };
