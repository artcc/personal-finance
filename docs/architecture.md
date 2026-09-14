# Architecture

Status: accepted modular-monolith and stack direction; detailed implementation proposals are recorded in the ADRs. No application code exists yet.

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
docs/
  adr/
  design/
  domain/
  specs/
infra/docker/
.github/workflows/
compose.yaml
compose.dev.yaml
.env.example
```

This tree describes the target layout. Empty application directories and placeholder configuration are not required during documentation phases. Shared tooling is extracted only when actual shared configuration exists.

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
| Identity | Owner identity, credentials, sessions | Authenticated owner context |
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

- One owner has accounts; each account can have spaces. A space cannot contain another space.
- Income sources and commitments have effective-dated revisions.
- A commitment may have a non-monthly obligation with a separate installment schedule.
- A monthly plan is identified by owner and planning month; it has revisions and a current revision pointer.
- Plan lines retain source ID, source revision, snapshotted label, dates, exact amount, kind, and calculation version.
- Allocation lines identify a destination and purpose, with references to funded plan lines where applicable.
- Closed revisions and audit events are immutable records.
- Financing and investment plans link to canonical planning sources. Actual investment operations are separate records.
- Financial records are entered manually. Plan provenance points to application source records and revisions; no workbook references or import batches are required in the runtime schema.

Schema details, indexes, numeric precision limits, and migration design are phase-2/feature deliverables, not implemented facts.

## Consistency and history

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

Do not emit credentials, session tokens, full financial payloads, or data exports into operational logs. Include request IDs and stable error codes. Database access remains on the internal network.

## Delivery and operation

- Pin compatible tool versions and maintain one committed lockfile after dependency approval.
- Build immutable, non-root web/API images with separate build and runtime stages.
- GitHub Actions runs agreed quality checks and, when configured, publishes private versioned images to GHCR.
- Compose defines readiness, durable database storage, and configuration without committed secrets.
- Backups and a demonstrated restore procedure are release deliverables.
- Detailed host integration and recovery objectives remain E-03/E-04 decisions.

## Deliberate complexity limits

Use a single transactional database and synchronous use cases for the initial workload. No distributed services, event bus, cache server, or background queue is assumed. Introduce additional infrastructure only in response to a documented requirement.
