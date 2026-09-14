# ADR 002 — Technology Stack

Status: accepted direction; exact versions pending. Date: 2026-09-14.

## Context

The owner accepted a TypeScript stack covering both applications, a typed contract, relational storage, automated checks, and Docker-based deployment.

## Decision

| Concern | Technology |
| --- | --- |
| Runtime/toolchain | Compatible stable Node.js and pnpm versions, strict TypeScript, pnpm workspaces |
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
- Selection of an OpenAPI generator, exact-decimal implementation, password-hashing implementation, and optional UI assets remains open.

## Alternatives considered

A separate backend language and a more minimal HTTP framework are viable, but the accepted stack favors one language and explicit NestJS modules. A larger monorepo orchestrator is unnecessary until workspace scripts show a real limitation.

## Follow-up

Resolve E-01 and obtain approval before dependency installation or updates. Pin runtime/package-manager versions and commit the resulting lockfile only when a commit is authorized. Never use unreviewed `latest` production image tags as a release strategy.
