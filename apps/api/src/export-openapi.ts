import { writeFile } from 'node:fs/promises';
import { createApplication } from './bootstrap.js';
import { readEnvironment } from './shared/environment.js';

const { app, document } = await createApplication(
  readEnvironment({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://contract:contract@127.0.0.1:5432/contract',
  }),
);
try {
  await writeFile(
    new URL('../openapi.json', import.meta.url),
    `${JSON.stringify(document, null, 2)}\n`,
  );
} finally {
  await app.close();
}
