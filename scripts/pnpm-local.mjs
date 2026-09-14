import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { packageManager } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const result = spawnSync(
  'npm',
  ['exec', '--yes', `--package=${packageManager}`, '--', 'pnpm', ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_cache: join(root, '.cache/npm'),
      XDG_CACHE_HOME: join(root, '.cache'),
      XDG_DATA_HOME: join(root, '.cache/share'),
      XDG_STATE_HOME: join(root, '.cache/state'),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
