import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/api/test/**/*.test.ts', 'apps/web/test/**/*.test.ts'],
    restoreMocks: true,
    testTimeout: 10_000,
    hookTimeout: 15_000,
    fileParallelism: false,
  },
});
