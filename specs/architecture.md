# Architecture

Status: phase-2 CI success reported by the owner; access, the approved visual direction, and phase-4 financial configuration implemented, with current runtime/CI verification pending. Later-phase financial proposals remain recorded in the ADRs.

Phase-4 update: accounts/spaces, recurring and one-month income, commitments, exact calculators, immutable source revisions, and financial audit events are implemented. The owner approved the visual direction and phase-4 financial policies. Current functional verification remains pending in CI; the phase-3 logout observer fix is included in this work.

Phase-5 update: the owner reported phase-4 CI green. Monthly planning is implemented with its own domain calculator, a small transaction-scoped persistence port, application lifecycle orchestration, and HTTP DTOs. It reuses the phase-4 financial write lock and source calculators without introducing another runtime service. Source projections are read on the same database transaction; domain code imports no ORM types. Current phase-5 CI evidence is still pending.

## System shape

```text
Browser
  |
  | HTTPS, one public origin
  v
Existing reverse proxy
  |
  v
Web container (static application + /api forwarding)
  |
  | internal HTTP
  v
API container (NestJS + Fastify modular monolith)
  |
  v
PostgreSQL (internal network, persistent volume)
```

The exact reverse-proxy configuration depends on the owner's host. The web and API share a public origin, simplifying cookie and CORS configuration. Portainer manages a versioned Compose deployment. Production migrations run as an explicit deployment step, not implicitly in every API replica startup.

## Planned repository structure

```text
apps/
  api/
    src/
      modules/
        identity/
        accounts/
        income/
        commitments/
        planning/
        financing/
        investments/
        data-portability/
      shared/
    prisma/
    test/
  web/
    src/
      app/
      features/
      components/ui/
      i18n/locales/es-ES/
      lib/
    e2e/
packages/
  api-client/
  tooling/
specs/
  adr/
  design/
  domain/
  specs/
docs/                  # Future static GitHub Pages website
infra/docker/
.github/workflows/
compose.yaml
compose.dev.yaml
.env.example
```

This tree describes the target business-module layout. The phase-2 implementation contains the API system/health module and shared configuration/database infrastructure, the web foundation page, and the API-client package. Future business-module directories are created when implemented. Shared tooling currently lives at the root instead of an empty tooling package.

## Backend boundaries

```text
HTTP adapters -> application use cases -> domain
                       |
                       v
                 narrow port contracts
                       ^
                       |
            infrastructure implementations
```

- **Domain:** entities/value objects, exact calculations, invariants, explicit policies. No framework decorators or database imports.
- **Application:** use cases, authorization context, transaction boundaries, orchestration, clock dependency, ports where needed.
- **Infrastructure:** Prisma repositories, session storage, hashing, export serialization, and other external implementations.
- **HTTP:** authentication, request validation, DTO mapping, status codes, and OpenAPI contracts.

Simple configuration CRUD can use straightforward application services. Complex financial policies receive independent domain functions or objects. Do not impose a class or interface per database table.

## Module ownership and collaboration

| Module | Owns | Public collaboration |
| --- | --- | --- |
| Identity | Registered users, credentials, sessions | Authenticated user context, public registration/login, user-scoped session management |
| Accounts | Accounts, spaces, destination availability | Destination read models and reference checks |
| Income | Effective-dated source definitions, monthly expected entries, tax breakdowns | Planning input projection |
| Commitments | Recurrent obligations, revisions, due schedules, provision policies | Planning-charge and due-payment projections |
| Planning | Saved monthly plan revisions, overrides, allocation lines, lifecycle events | Monthly summaries and allocation instructions |
| Financing | Agreement metadata, reported debt, financing-to-commitment linkage | Creates/updates one linked commitment through its application interface |
| Investments | Products, platforms, actual operations, valuations, investment-plan linkage | Maintains one classified planning source per contribution plan |
| Data portability | Export formats and serialization | Reads consistent data through supported application interfaces |

Phase 5 can use explicitly classified financing and investment planning sources before specialized phase-6 screens exist. Later linking must preserve source identity and uniqueness instead of creating another charge.

Cross-module domain imports are limited to truly shared primitives, such as `Money` and `PlanningMonth`. Modules consume application interfaces/read projections, not each other's ORM internals. Planning gathers inputs in a consistent database transaction before persisting a snapshot.

## Conceptual data relationships

- Multiple independent users can register. Each user has private accounts; each account can have spaces. A space cannot contain another space or reference another user's account.
- Income sources and commitments have effective-dated revisions.
- A commitment may have a non-monthly obligation with a separate installment schedule.
- A monthly plan is identified by owner and planning month; it has revisions and a current revision pointer.
- Plan lines retain source ID, source revision, snapshotted label, dates, exact amount, kind, and calculation version.
- Allocation lines identify a destination and purpose, with references to funded plan lines where applicable.
- Closed revisions and audit events are immutable records.
- A database trigger prevents updates to closed monthly-plan revisions. Plan-level versions remain monotonic across reopenings; snapshots retain their own revision/version metadata.
- Financing and investment plans link to canonical planning sources. Actual investment operations are separate records.
- Financial records are entered manually. Plan provenance points to application source records and revisions; no workbook references or import batches are required in the runtime schema.

The phase-2 baseline created an empty `owners` table. Phase 3 preserves its rows/UUIDs, renames it to `users`, and removes singleton uniqueness so multiple accounts can exist. The old marker remains an ignored column rather than being destructively removed. New `credentials` and `sessions` tables hold authentication data; no default user or credentials are seeded. Financial schema details and numeric precision limits remain feature deliverables.

## Consistency and history

Phase-4 financial mutations use a shared infrastructure transaction helper that locks the current user's row. Each capability keeps its own application service, port, and persistence adapter; shared infrastructure performs atomic destination/reference checks on that transaction's connection. Domain calculators remain independent of Prisma and NestJS. Composite foreign keys enforce that destination accounts/spaces belong to the same user as their financial source.

Income and commitment revisions retain validated input provenance and normalized exact monetary data. Same-effective-month revisions use increasing versions; list filtering resolves the selected revision before pagination. This is deliberately a personal-dataset projection, not a claim of optimized bulk-report performance.

- Enforce one plan identity per owner/month and unique revision numbers at the database level.
- Generate a plan atomically; repeat creation returns the existing result rather than overwriting it.
- Use an expected version for edits, refresh, close, and reopen; stale versions produce a conflict.
- Resolve inputs in a consistent transaction snapshot. On serialization conflicts, retry only operations whose semantics are safe to retry.
- Source changes do not automatically mutate existing plans. Explicit draft refresh offers a preview and preserves protected overrides.
- Closing stores final amounts and relevant source descriptions. Reading a closed plan must not recalculate it using today's configuration.
- Audit lifecycle and financial changes in the same transaction as the state change.

## Frontend design

- Organize features around monthly planning, accounts, commitments, income, financing, and investments.
- Use React Router for navigation and TanStack Query for server data and invalidation.
- Use React Hook Form and Zod for input feedback; server-side rules remain authoritative.
- Consume generated API types. Do not import backend domain or Prisma types into the web app.
- For financial previews, call an API preview endpoint using the same domain calculator as persistence. Avoid a separate client-side financial engine.
- Use semantic design tokens over Tailwind/shadcn components and follow the [design guide](design/ui-ux.md).
- Load initial Spanish translation namespaces. Shared errors return stable codes; the frontend supplies localized copy.

## API and security

REST endpoints use `/api/v1`. Financial endpoints require an authenticated owner. Proposed error envelopes and wire money representations are described in ADRs 003 and 006.

Use opaque server-side sessions and secure HttpOnly cookies, with explicit expiry/revocation, CSRF protection on state-changing requests, origin checks, and login rate limiting. Same-origin hosting does not remove CSRF requirements. Configure trusted proxies deliberately for secure-cookie and client-IP behavior.

Phase 3 implements those access boundaries in the identity module. A default-deny global Nest guard authenticates private controllers and exposes the authenticated session to application use cases. The identity persistence adapter scopes session operations to that user. Credentials use Node scrypt; cookie parsing and per-IP access limits use the approved Fastify plugins. Registration/login and system health are explicitly public.

All future financial queries, mutations, relationship checks, and exports must include the session-derived user identity. The guard establishes identity but does not replace object-level ownership checks. The web clears private query caches on logout, expiry, or identity change and synchronizes access changes across same-origin tabs using BroadcastChannel.

Do not emit credentials, session tokens, full financial payloads, or data exports into operational logs. Include request IDs and stable error codes. Database access remains on the internal network.

## Delivery and operation

- Pin compatible tool versions and maintain one committed lockfile after dependency approval.
- Build immutable, non-root web/API images with separate build and runtime stages.
- GitHub Actions runs the implemented checks on pushes to `main` and pull requests. A reusable CI entry point lets stable GitHub release publication check the exact release commit before publishing API/web images to private GHCR packages.
- Phase 2 provides version and full-commit image tags, OCI source/revision metadata, amd64/arm64 publication, and digest summaries. It does not automatically update Portainer or create releases. See [release image delivery](release-images.md).
- Compose defines readiness, durable database storage, and configuration without committed secrets.
- Backups and a demonstrated restore procedure are release deliverables.
- Detailed host integration and recovery objectives remain E-03/E-04 decisions.

Generated OpenAPI JSON, client declarations, and Prisma source are reproducible build artifacts rather than hand-authored or committed files. The build regenerates them in dependency order, type-checks consumers, and CI checks regeneration determinism. The generated-client package copies its schema declarations into its compiled output. There is no duplicate handwritten response model.

## Deliberate complexity limits

Use a single transactional database and synchronous use cases for the initial workload. No distributed services, event bus, cache server, or background queue is assumed. Introduce additional infrastructure only in response to a documented requirement.
