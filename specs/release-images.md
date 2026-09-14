# Release Image Delivery

Status: release-image publication uses native AMD64/ARM64 runners. The owner supplied failed API and web logs for `v0.0.1`; the native-build correction has not yet been executed in CI. Full host operations and backup/restore acceptance remain in phase 8.

Phase-3 update: the owner reported phase-2 CI green. Access now requires `APP_ORIGIN` to match the public HTTPS origin; configure `TRUST_PROXY` only for known proxy IPs/CIDRs. The database migration adds independent registered users and sessions without discarding existing identity UUIDs. First release publication and host-specific operations still need separate verification.

## Trigger and flow

`.github/workflows/release-images.yml` runs when a GitHub release is **published**. A bare Git tag push is not the publication trigger. Draft releases do not trigger it; prereleases are skipped. Stable release tags must match `vMAJOR.MINOR.PATCH`, for example `v0.1.0`.

```text
Publish a stable GitHub release
  -> Validate tag shape
  -> Check out the release event's exact commit SHA
  -> Reusable CI: lint, format, build, types, contract, migrations, tests
  -> Container build/startup checks
  -> Build API and web images on native amd64 and arm64 runners
  -> Push architecture-specific GHCR version/SHA tags
  -> After all four builds succeed, create multi-platform version/SHA tags
  -> Record image digests in workflow summaries
  -> Owner selects the version for Docker/Portainer deployment
```

All checks and builds use the same event commit, not the moving head of `main`. The release workflow does not create a release, push source commits, call a Portainer webhook, or update a running deployment.

## Published images

| Component | Version tag example | Commit tag |
| --- | --- | --- |
| API | `ghcr.io/artcc/personal-finance-api:v0.1.0` | `sha-` followed by the full commit SHA |
| Web | `ghcr.io/artcc/personal-finance-web:v0.1.0` | `sha-` followed by the full commit SHA |

Tags are readable identifiers; registry digests identify immutable image content. Workflow summaries include both tag and digest. There is no mutable `latest` tag. OCI metadata records source repository, revision, release version, and license.

Both targets publish `linux/amd64` and `linux/arm64`. Each target is built separately on `ubuntu-24.04` (AMD64) and `ubuntu-24.04-arm` (ARM64), without QEMU. Build caches are scoped by target and architecture. Intermediate tags append `-amd64` or `-arm64` to the release version and full-commit tag. Once all four builds succeed, `docker buildx imagetools create` combines the architecture-specific release tags into the version and commit tags consumed by Compose.

Ordinary CI smoke-checks amd64 containers; release jobs compile both architectures natively. An arm64 build alone is not an arm64 runtime test.

API and web publication is not atomic. If one matrix job fails after the other publishes, do not deploy that version until the entire workflow succeeds. Reruns may rebuild a tag; use recorded digests when exact artifact identity is required.

### ARM64 generation failure

The `v0.0.1` release run `34893325202` at commit `9d56333604daf844907c37f7ff04eaafd7e73400` generated Prisma successfully on AMD64, while both API and web builds failed at ARM64 `prisma generate` under QEMU with `get-dmmf wasm`, `P1012`, and 102 errors. Diagnostics rejected existing identifiers and valid literals such as `true` and `Cascade`, pointing to the emulated validator execution rather than absent model fields. The workflow now builds each architecture natively; the Prisma schema, dependency versions, and Docker runtime targets are unchanged.

A rerun of that existing release uses its original commit and workflow. Publish a new release tag containing the correction after committing and pushing it; a rerun alone will not pick up changes from `main`.

Local evidence (2026-09-14): with owner authorization, `node scripts/pnpm-local.mjs exec prettier --check .github/workflows/release-images.yml` passed. No local container build or runtime test was executed; native ARM64 generation and multi-platform publication require a successful corrected workflow run.

## GitHub/GHCR configuration

- Keep the repository and packages private. Newly created GHCR packages default to private; confirm access settings on first publication and retain that visibility for existing packages.
- Publishing jobs use `GITHUB_TOKEN` with `contents: read` and `packages: write`; quality jobs require only repository read access.
- No publishing personal access token is committed or required by this workflow. The repository must have Actions/package publishing enabled, and existing packages must grant the workflow repository write access.
- Actions are pinned to the commit SHAs of the stable releases consulted during scaffolding. Updating these pins requires the normal reviewed dependency-update process.
- First publication needs an explicitly authorized release after the scaffold is committed/pushed. This document does not imply a release already exists.

## Images and migrations

`infra/docker/Dockerfile` has a shared multi-stage builder and two final targets:

- `api`: Node 26.8.2, pruned production dependencies, compiled API, Prisma schema/migrations/config, non-root `node` user. Prisma CLI is a production dependency to support the explicit migration service.
- `web`: unprivileged Nginx 1.30.4, built static assets, internal API forwarding, non-root runtime on port 8080.

The API healthcheck distinguishes process liveness from database readiness. The Compose configuration overrides API health with readiness and waits for PostgreSQL plus the one-shot migration service before starting the app path. Migrations are not executed implicitly by API startup.

## Consuming a release with Docker Compose

On the deployment host, create an untracked `.env` from `.env.example`, set independent database credentials, and select a successfully published release tag. Use `docker-compose.yaml` for production; `.env-dev.example` and `docker-compose.dev.yaml` are for local development. `DATABASE_URL` must use the internal `database` hostname and URL-encoded credentials where necessary; do not copy the local `127.0.0.1` development URL.

Authenticate the deployment host to GHCR using a read-only package credential through Docker's credential handling. Configure the registry in Portainer with equivalent pull access. Never put tokens into Compose files or commit them to Git.

Once host authentication and environment are configured:

```sh
docker compose --env-file .env -f docker-compose.yaml pull
docker compose --env-file .env -f docker-compose.yaml up -d
```

The Compose dependency graph runs `prisma migrate deploy` as a one-shot service before the API. Confirm migration success before accepting an update. The database has no published host port in this configuration. The web port is bound to loopback by default for a reverse proxy on the same host; adapt networking explicitly if the existing reverse proxy runs in another container/network.

Portainer can consume the repository's Compose file and environment values, provided its Docker Standalone/Compose implementation supports the health and completed-service conditions used here. This is not a Docker Swarm stack definition; confirm the actual host arrangement under E-03.

Database volumes persist across updates. Changing credentials in environment variables does not change credentials in an already initialized PostgreSQL volume; handle that as a separate operational change. Never delete a data volume to solve an update problem.

## Later operational gate

Phase 8 completes trusted-proxy/HTTPS behavior, backup retention and restoration, monitoring/log rotation, migration/rollback compatibility, and host-specific Portainer procedures. Image publication is delivery infrastructure, not proof that those operational requirements are complete.
