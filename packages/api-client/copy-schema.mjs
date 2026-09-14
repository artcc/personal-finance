import { copyFile } from 'node:fs/promises';

await copyFile(
  new URL('src/schema.gen.d.ts', import.meta.url),
  new URL('dist/schema.gen.d.ts', import.meta.url),
);
