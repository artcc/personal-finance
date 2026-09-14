# Development and CI Commands

## Runtime policy

Use the newest stable compatible stack. Current CI and Docker runtime: Node 26.8.2, pnpm 12.4.1, PostgreSQL 18.6. Exact direct dependency versions are pinned in package manifests; transitive versions are recorded in `pnpm-lock.yaml`.

TypeScript 5.9.3 is an explicit tooling compatibility exception, documented in ADR 002. Prisma uses stable 7.10.0 rather than the latest-tagged 8.0.0 release candidate.

The owner uses the existing macOS Node installation and does not compile/test locally. Do not install another Node version, Docker, or global pnpm as part of this workflow.

## Local lint-only setup

From the repository root:

```sh
node scripts/pnpm-local.mjs install --ignore-scripts
node scripts/pnpm-local.mjs lint
```

The helper invokes the pinned pnpm through npm using project-local npm cache, XDG cache/data/state locations, and the workspace's `.pnpm-store`. It does not download a Node runtime. Git ignores these local caches and `node_modules`.

`--ignore-scripts` avoids dependency lifecycle execution locally. Consequently, do not expect generated Prisma code, generated API types, or compiled applications to exist after this install. Lint does not require those artifacts.

CI and Docker installations use the pnpm 12 `allowBuilds` policy in `pnpm-workspace.yaml`: Prisma, its engines, and esbuild may run installation scripts; the optional Scarf analytics script is explicitly denied. `strictDepBuilds` stays enabled so unreviewed scripts fail installation. The removed `onlyBuiltDependencies` setting must not be used. Local `--ignore-scripts` still disables all these scripts, even when the shared policy allows them.

With explicit permission, format source/configuration using:

```sh
node scripts/pnpm-local.mjs format
```

Local tests, type checks, code generation, builds, and containers require new owner authorization. The following commands document CI or a separately authorized build environment, not actions to run automatically on the owner's Mac.

## Build graph

```text
pnpm build
  -> Prisma client generation
  -> API TypeScript compilation
  -> OpenAPI JSON export from the compiled Nest application
  -> API-client declaration generation
  -> API-client compilation and declaration copy
  -> Web type check and Vite build
```

OpenAPI export creates an application context but does not connect to PostgreSQL or open a listening socket. Its placeholder connection string is never used to query a database. Prisma generation also requires no running database. No financial or authentication records are created by a build.

## Existing commands

| Command | Purpose / prerequisite |
| --- | --- |
| `pnpm lint` | ESLint over handwritten source/configuration; no compile step |
| `pnpm format:check` | Prettier check for supported source/configuration files; Markdown and generated output excluded |
| `pnpm format` | Apply source/configuration formatting; explicit local permission required |
| `pnpm build:api` | Generate Prisma client and compile API |
| `pnpm api:generate` | Export OpenAPI and generate client declarations; needs compiled API |
| `pnpm build` | Complete ordered build graph |
| `pnpm typecheck` | Check all workspace source and API tests; run after the build graph has generated artifacts |
| `pnpm contract:check` | Regenerate and compare contract/client artifacts; run after build |
| `pnpm db:migrate` | Apply committed Prisma migrations to `DATABASE_URL`; do not point it at an unintended database |
| `pnpm test:unit` | Environment-boundary and session-lifetime policy tests |
| `pnpm test:http` | Health HTTP tests using compiled API and mocked database availability |
| `pnpm test:db` | Actual PostgreSQL rollback, independent-account, authentication, and session-isolation tests; requires a migrated disposable `_test` database |
| `pnpm test:e2e` | Built web/API browser journey; requires installed Chromium |
| `pnpm dev` | Build required artifacts, then watch API compilation/server and run Vite; compilation is not authorized in the current local workflow |

Changing an API response requires regenerating the schema/client and rebuilding the client before checking web consumers. Generated files are not hand-edited or committed.

## Environment and database

`.env.example` documents local development values. API startup reads typed environment configuration; the database URL must use a PostgreSQL protocol. Startup fails without it, while `/api/v1/health/live` does not query the database. `/api/v1/health/ready` performs a bounded database check and returns 503 with `DATABASE_UNAVAILABLE` on failure.

The baseline created an empty `owners` table. The phase-3 migration preserves those rows as `users`, removes singleton uniqueness, and adds `credentials` and `sessions`. Web registration creates a user and credential atomically; there are no default credentials. Do not edit or remove the old migration to achieve this change.

`APP_ORIGIN` is required to match the browser's exact origin. Production uses HTTPS and a Secure cookie; test/development allow loopback HTTP. Use `http://127.0.0.1:5173` for Vite and `http://127.0.0.1:4173` for browser tests. `TRUST_PROXY=false` is the default; a known proxy IP/CIDR list is an explicit deployment setting. When the API is behind a proxy, configure that list so per-IP throttling sees real client addresses instead of grouping every request under the proxy address.

For a separately authorized development environment with Docker:

```sh
docker compose --env-file .env -f compose.dev.yaml up -d
pnpm db:migrate
pnpm dev
```

Prepare `.env` from the example first. Development PostgreSQL is bound only to `127.0.0.1:5432`. PostgreSQL 18 uses a volume mounted at `/var/lib/postgresql`. The CI database is independently provisioned and disposable; do not reuse the development volume for integration tests.

## Foundation endpoints and web

- Web development server: `http://127.0.0.1:5173`.
- Built-web preview: `http://127.0.0.1:4173`.
- API liveness: `http://127.0.0.1:3000/api/v1/health/live`.
- API readiness: `http://127.0.0.1:3000/api/v1/health/ready`.
- Development-only OpenAPI JSON: `http://127.0.0.1:3000/api/openapi.json`.

Vite proxies `/api` to the API so the browser uses one origin. `/register` and `/login` are public access screens; `/` and `/settings/security` require a valid session. The shell shows an honest pre-financial-feature state and the current user's sessions. Financial endpoints remain subsequent-phase work.

## Operator-only access recovery

On the deployment host, with migrated database configuration and compiled API:

```sh
pnpm --filter @personal-finance/api auth:reset-password user@example.com
pnpm --filter @personal-finance/api auth:prune-sessions
```

The password-reset command prompts for a hidden password and confirmation in a terminal. Standard input is supported for controlled non-interactive operation; never pass a password as a command-line argument. It updates one existing account and invalidates that account's sessions, including credentials-version races. Session pruning removes expired/revoked session records only. These are operator actions, not commands to execute on the owner's Mac during development.

The equivalent commands in the API container are `node dist/modules/identity/cli.js reset-password <email>` and `node dist/modules/identity/cli.js prune-sessions`. Registration is performed through the web, not a bootstrap command. Email delivery/verification and self-service email recovery are not implemented.

## Visual review without a build

Open `docs/design/phase-3-preview.html` in a browser directly. It has no external assets, API requests, or storage. Use the screen, viewport, and state controls to review synthetic financial layouts. English labels belong to design documentation; production-facing Spanish copy remains in i18n resources. CI captures desktop/mobile screenshots of access screens, the private shell, and this prototype as browser-evidence artifacts.

## Evidence boundary

Local dependency installation and ESLint have completed using the existing Node runtime. With owner authorization, Prettier was applied to source/configuration and ESLint passed again afterward. No local build, type check, migration, unit/HTTP/database/browser test, or container execution has been performed. GitHub workflow files describe future execution and are not evidence of a successful run.

The first reported CI run failed during dependency installation with `ERR_PNPM_IGNORED_BUILDS`: the workspace still used the removed `onlyBuiltDependencies` option. It was replaced by the explicit `allowBuilds` policy above, and the owner subsequently reported phase-2 CI green. Phase-3 authentication and migration checks require a new CI run; local lint/format results do not validate runtime behavior.

Phase-3 local evidence: the two approved Fastify plugins were installed using `--ignore-scripts`, Prettier was applied with authorization, and ESLint passed. No local build, type check, generation, test, migration, or container execution was performed. Owner review of the financial design proposal remains pending.
