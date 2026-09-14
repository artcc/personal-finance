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
| `pnpm test:unit` | Environment-boundary tests |
| `pnpm test:http` | Health HTTP tests using compiled API and mocked database availability |
| `pnpm test:db` | Actual PostgreSQL singleton and rollback tests; requires migrated, empty disposable `_test` database |
| `pnpm test:e2e` | Built web/API browser journey; requires installed Chromium |
| `pnpm dev` | Build required artifacts, then watch API compilation/server and run Vite; compilation is not authorized in the current local workflow |

Changing an API response requires regenerating the schema/client and rebuilding the client before checking web consumers. Generated files are not hand-edited or committed.

## Environment and database

`.env.example` documents local development values. API startup reads typed environment configuration; the database URL must use a PostgreSQL protocol. Startup fails without it, while `/api/v1/health/live` does not query the database. `/api/v1/health/ready` performs a bounded database check and returns 503 with `DATABASE_UNAVAILABLE` on failure.

The baseline migration creates an empty `owners` table with an enforceable singleton constraint. It creates no owner credentials or data. Authentication and bootstrap are phase-3 work.

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

Vite proxies `/api` to the API so the browser uses one origin. The localized foundation page checks API liveness through the generated client; it deliberately does not claim that the database is connected. There are no financial endpoints or access flows yet.

## Evidence boundary

Local dependency installation and ESLint have completed using the existing Node runtime. With owner authorization, Prettier was applied to source/configuration and ESLint passed again afterward. No local build, type check, migration, unit/HTTP/database/browser test, or container execution has been performed. GitHub workflow files describe future execution and are not evidence of a successful run.

The first reported CI run failed during dependency installation with `ERR_PNPM_IGNORED_BUILDS`: the workspace still used the removed `onlyBuiltDependencies` option. It has been replaced by the explicit `allowBuilds` policy above. A new CI run is required to verify this correction; the earlier local lint/format results do not validate it.
