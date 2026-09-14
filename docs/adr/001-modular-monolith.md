# ADR 001 — Modular Monolith

Status: accepted direction. Date: 2026-09-14.

## Context

The application serves one owner but must support clear business rules, reliable history, tests, and self-hosted operation. The owner requested separate frontend/backend applications with a maintainable architecture.

## Decision

Use a pnpm monorepo containing a React web application and a NestJS API. The API is a modular monolith backed by one PostgreSQL database. Apply lightweight hexagonal boundaries to business logic: domain, application, infrastructure, and HTTP.

Organize backend modules by business capability. Keep financial rules in the backend and expose narrow application interfaces between modules. Use transactions for cross-module planning snapshots.

## Consequences

- Straightforward deployment and transactional consistency.
- Explicit ownership of data and calculations without distributed infrastructure.
- Module boundaries must be maintained through imports, application interfaces, and review.
- Configuration CRUD should remain simple; ports isolate real external boundaries rather than duplicating every ORM operation.

## Alternatives considered

- Microservices: unnecessary operational and consistency overhead for this scope.
- A frontend-only application: insufficient for the required persistence, authentication, backend rules, and operation.
- A full-stack framework with business logic spread across route handlers: possible, but less aligned with the accepted separate API structure.

## Follow-up

Implement the module layout and enforce practical dependency boundaries during scaffolding. Do not add tooling dependencies without approval.
