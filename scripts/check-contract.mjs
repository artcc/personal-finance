import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const files = ['apps/api/openapi.json', 'packages/api-client/src/schema.gen.d.ts'];
const original = await Promise.all(files.map((file) => readFile(file)));
execFileSync('pnpm', ['api:generate'], { stdio: 'inherit' });
const regenerated = await Promise.all(files.map((file) => readFile(file)));
if (original.some((content, index) => !content.equals(regenerated[index]))) {
  throw new Error('API contract generation is not deterministic.');
}
console.info('API schema and client generation are deterministic.');
