# ADR 005 — Single-Owner Authentication

Status: proposed implementation of the single-owner access requirement. Date: 2026-09-14.

## Context

The installation is private and self-hosted. It needs protected financial data and access recovery, with no public registration or commercial identity platform requirement.

## Decision

Use a single owner account with a password and opaque server-side sessions stored in PostgreSQL. Persist a hash of session tokens, not raw bearer tokens. Send the session identifier only in a secure HttpOnly cookie. Rotate sessions on authentication and revoke them on logout and credential recovery.

Provide a documented server-side bootstrap/recovery command in the authentication phase. Do not ship default credentials or a permanently exposed public setup endpoint. Choose password hashing, token entropy, session idle/absolute lifetimes, and login throttling in the authentication spec.

Require authentication on all financial endpoints. Reject foreign-origin state-changing requests and implement CSRF protection. Apply explicit trusted-proxy settings and cookie scope. Return generic authentication errors without exposing credential or session details.

## Consequences

- Revocation is immediate without a distributed token invalidation scheme.
- No Redis or external identity provider is required.
- Session cleanup and offline access recovery need documented operational procedures.
- Local development cookie settings must be explicit rather than weakening production defaults.

## Alternatives considered

- Long-lived browser JWTs: complicate revocation and increase token-handling responsibility.
- External SSO: useful if requested later; currently adds infrastructure and configuration.

## Follow-up

Resolve E-05, obtain dependency approval, and complete the phase-3 authentication spec, including recovery, CSRF, expiry, and rate-limit acceptance tests.
