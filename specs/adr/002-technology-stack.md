# ADR 002 — Technology Stack

Status: accepted direction; phase-2 versions selected with owner approval. Date: 2026-09-14.

## Context

The owner accepted a TypeScript stack covering both applications, a typed contract, relational storage, automated checks, and Docker-based deployment.

## Decision

| Concern | Technology |
| --- | --- |
| Runtime/toolchain | Node 26.8.2, pnpm 12.4.1, strict TypeScript 5.9.3, pnpm workspaces |
| Web | React, Vite, React Router, TanStack Query |
| Forms | React Hook Form and Zod |
| Components | Tailwind CSS and shadcn/ui, customized through shared tokens |
| API | NestJS with Fastify adapter |
| Contract | REST, OpenAPI, generated frontend client |
| Data | PostgreSQL, Prisma, versioned SQL migrations |
| Localization | i18next, react-i18next, Intl |
| Quality | ESLint, Prettier, TypeScript checking |
| Tests | Vitest, HTTP integration tests, PostgreSQL-backed integration tests, Playwright |
| Delivery | GitHub Actions, private GHCR images, Docker Compose, Portainer |

## Consequences

- A shared language reduces tooling fragmentation while backend domain ownership remains explicit.
- Generated client artifacts require a deterministic generation/check workflow.
- Prisma types stay in infrastructure and mappings, not financial domain types.
- Test integration with NestJS decorators and the chosen build pipeline must be verified during scaffolding.
- The OpenAPI pipeline uses `openapi-typescript` 7.13.0 and `openapi-fetch` 0.17.0. Exact-decimal implementation, password hashing, and optional UI assets remain open.

## Alternatives considered

A separate backend language and a more minimal HTTP framework are viable, but the accepted stack favors one language and explicit NestJS modules. A larger monorepo orchestrator is unnecessary until workspace scripts show a real limitation.

## Follow-up

E-01 is resolved for scaffolding. The policy is newest stable compatible releases, not LTS by default. Prisma 7.10.0 excludes the 8.0.0 release candidate; PostgreSQL 18.6 excludes the 19 beta. TypeScript 5.9.3 remains necessary because the selected generator requires `^5.x` and the ESLint parser requires `<6.1.0`, although TypeScript 7.0.2 exists. Do not suppress peer errors or introduce prereleases to force an upgrade.

Node 26.8.2 remains the owner's existing local version and is pinned in CI/Docker. The local pnpm helper keeps package-manager caches inside the project; no Node switching or global installation is performed. Obtain approval for subsequent dependency changes. Commit the lockfile only when a commit is authorized. Deploy explicit release tags or immutable digests, not a mutable `latest` alias.
