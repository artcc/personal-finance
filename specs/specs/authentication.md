# Registration, Authentication, and Private Sessions

Status: phase-3 implementation specification. User registration and independent accounts are owner-approved. Security values below are explicit implementation defaults, not financial policy decisions.

## User journeys

1. Register with display name, email, password, and client-side password confirmation.
2. Sign in with email/password and enter the private application shell.
3. Reload or open another private route with the existing session.
4. Review active sessions and revoke one or all of the current user's sessions.
5. Log out and return to the access page without retaining private query data.
6. Recover access through an operator-only command on the deployment server.

## Data model

- `User`: UUID, created timestamp; preserved phase-2 identity rows and ignored legacy marker.
- `Credential`: one per user; unique normalized email, display name, encoded password hash, credential version, audit timestamps.
- `Session`: UUID, user credential relation, unique token digest, random CSRF token, credential-version snapshot, creation/last-seen/idle/absolute expiry, optional revocation timestamp.

The browser receives public identity/session DTOs only. Password hashes, token digests, and database internals are never returned. Every session operation is scoped to the authenticated user.

## Registration and password rules

- Trim/lowercase email; maximum 254 characters and valid email syntax. Do not transform the password.
- Trim display name, requiring 1–80 characters.
- Password length: 12–128 characters; permit spaces and Unicode; no arbitrary character-class requirements.
- Confirmation is checked in the web form; the API accepts only the password itself.
- Account creation and its credential are atomic; normalized email uniqueness is enforced in PostgreSQL, including concurrent registration.
- An existing email produces the generic code `REGISTRATION_FAILED`, not account details. Invalid login uses `INVALID_CREDENTIALS` whether the account is missing or the password is wrong.
- Verify a fixed dummy hash for an unknown account to avoid the simple missing-user timing shortcut.
- Use scrypt with `N=131072`, `r=8`, `p=1`, a 16-byte random salt, 64-byte derived key, and 256 MiB maximum memory. Limit concurrent hashing work to two operations per API process.

## Sessions

- Session tokens contain 32 random bytes encoded as base64url; only SHA-256 digests are persisted.
- Issue a fresh session after successful registration/login. Authentication never accepts a caller-chosen token.
- Absolute lifetime is 7 days; idle lifetime is 12 hours, extended only while both the idle and absolute windows remain valid.
- Persist and check a credential-version snapshot so an old-password login racing a reset cannot authorize a new valid session afterward.
- Production cookie: `__Host-pf_session`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no domain attribute. Development/test use a separate unprefixed cookie without `Secure` for loopback HTTP.
- Revocation and expiry are enforced on the API, not only by cookie expiry or frontend state.
- On invalid/expired authentication, return `AUTH_REQUIRED`. The frontend clears private query state and redirects to login.
- Login/logout must update the existing observed session query rather than remove it from the cache and create a new instance. Keep mounted route guards subscribed while discarding other private queries and mutation data; propagate the change to other tabs.
- Session cleanup deletes only expired or revoked rows through an explicit operator command. Do not add a queue or scheduler.

## Origin, CSRF, and abuse controls

- `APP_ORIGIN` is a single canonical origin. Production requires HTTPS; development/test allow loopback HTTP.
- Require exact matching `Origin` and JSON content type for registration/login and authenticated mutations. Missing/mismatched Origin is rejected, including cross-site logout and login CSRF attempts.
- Authenticated mutations require `X-CSRF-Token` matching the current session's random token, compared in constant time.
- GET session returns the CSRF token only to a browser already presenting its session cookie. Do not enable cross-origin credentialed API access.
- Access responses use `Cache-Control: no-store`.
- Registration: at most 10 requests per IP per hour; login: 10 requests per IP per 15 minutes. Native hashing concurrency is separately bounded.
- The single-process rate limiter resets on process restart. Keep this limitation explicit; no distributed guarantee is claimed.
- `TRUST_PROXY` defaults to false. An explicit comma-separated list of trusted proxy addresses/CIDRs is the only supported opt-in; do not accept `true` as trust-all.
- Keep credentials/cookies/CSRF tokens out of operational logs and URLs.

## HTTP contract

| Method / path | Access | Result |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Public; Origin, JSON, rate limit | Create account and issue session cookie; public session DTO |
| `POST /api/v1/auth/login` | Public; Origin, JSON, rate limit | Authenticate and issue new session cookie; public session DTO |
| `GET /api/v1/auth/session` | Authenticated | Current user, session expiry, and CSRF token |
| `GET /api/v1/auth/sessions` | Authenticated | Current user's active sessions only |
| `DELETE /api/v1/auth/sessions/{id}` | Authenticated; Origin and CSRF | Revoke only a session belonging to this user; 404 otherwise |
| `POST /api/v1/auth/logout` | Authenticated; Origin, JSON, CSRF | Revoke current session and clear cookie |
| `POST /api/v1/auth/logout-all` | Authenticated; Origin, JSON, CSRF | Revoke all sessions for the current user and clear cookie |

Health endpoints remain public and contain no user/financial data. All other controller routes require authentication by default unless explicitly marked public. Future financial controllers inherit that default and still require user-scoped queries.

## Recovery

`auth:reset-password` is an operator-only command for an existing normalized email. It accepts a new password through hidden terminal input or standard input, not a command-line password argument. Reset updates the hash/version and revokes the target user's sessions atomically. Other users remain unaffected. The login page explains that recovery requires the server operator; it must not promise email delivery.

## Error codes

`INVALID_AUTH_INPUT`, `INVALID_CREDENTIALS`, `REGISTRATION_FAILED`, `AUTH_REQUIRED`, `ORIGIN_REJECTED`, `CSRF_REJECTED`, `AUTH_RATE_LIMITED`, `AUTH_BUSY`, `SESSION_NOT_FOUND`.

HTTP status: invalid fields 422; authentication 401; Origin/CSRF 403; out-of-scope session 404; registration conflict 409; throttling/hashing capacity 429. Unexpected infrastructure errors use the existing safe 500 envelope. Field copy and all frontend text are Spanish i18n resources.

## Acceptance coverage

- Registration creates two independent users; simultaneous duplicate emails cannot create duplicate credentials.
- Login succeeds only with valid credentials; unknown email and bad password share the public error contract.
- Cookies have appropriate production/development flags and session tokens are absent from persisted records.
- Tampered, expired, idle-expired, revoked, and credential-version-stale sessions cannot authenticate.
- Origin and CSRF violations are rejected; a valid same-origin logout succeeds.
- User B cannot list or revoke user A's sessions, even with a known UUID.
- Logout-all and password recovery affect only the current/targeted account.
- Reloading preserves a valid session; logging out clears private cache and protects direct private-route navigation.
- Register/login forms retain non-secret input after errors, clear passwords on success, support password managers, keyboard access, and mobile layouts.

Tests are authored for CI. No local compilation, database mutation, code generation, or test execution is authorized by this specification.
