# ADR 009 — Independent User Accounts

Status: scope accepted by the owner during phase 3. Date: 2026-09-14. Supersedes ADR 005's single-owner and server-only registration proposal.

## Context

The owner explicitly requested registration and login through the web and selected multiple independent users rather than one initial owner account. The existing modular monolith and single PostgreSQL database remain appropriate.

## Decision

- Provide public web registration and email/password login.
- Keep every user's financial workspace private. No organizations, shared budgets, or cross-user access are introduced.
- Resolve identity from an opaque cookie backed by a server-side session. Persist only the session token's SHA-256 digest.
- Use Node's stable asynchronous scrypt implementation for passwords. Do not use experimental crypto APIs or introduce a native hashing dependency.
- Use maintained Fastify cookie and rate-limit plugins. Require exact configured Origin for browser mutations and a session-bound CSRF token for authenticated mutations.
- Default to 7-day absolute sessions and 12-hour inactivity expiry. Logout revokes server state; password recovery invalidates all sessions for that user only.
- Registration does not imply verified ownership of an email address. Email verification and self-service email recovery require a separately configured delivery service and are not claimed by this implementation.
- Provide an operator-only password recovery command targeting one existing account, without exposing a public reset bypass.

## Data migration and isolation

Preserve the phase-2 identity rows and UUIDs. Rename the identity table to `users` and remove its singleton uniqueness constraint. Keep the legacy marker column ignored by Prisma rather than discarding existing values. Add separate credentials and sessions, with foreign keys to users and unique normalized email/token digests. Existing rows without credentials cannot authenticate automatically.

All future financial records carry `userId`. Authenticated user context, not request-supplied ownership fields, scopes reads, mutations, relationships, and exports. User B cannot revoke or inspect user A's sessions. Return a not-found result for an out-of-scope resource rather than revealing its owner.

## Consequences

- The product/spec/agent rules must reflect multiple private workspaces before financial modules are implemented.
- Existing single-owner tests are replaced by multiple-account and isolation invariants.
- In-memory per-IP throttling assumes the current single API process; horizontally scaled replicas require a shared limiter before deployment in that configuration.
- Trusted-proxy configuration must name known proxy addresses/CIDRs. Never trust arbitrary forwarded client addresses by default.
- The repository's private visibility does not control application registration.

## Evidence

The scope is owner-approved. Implementation, automated tests, and visual review are tracked separately; approval of this ADR is not evidence that runtime checks passed.
