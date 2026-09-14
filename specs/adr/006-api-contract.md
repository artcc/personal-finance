# ADR 006 — REST, OpenAPI, and Generated Client

Status: accepted contract direction; wire details proposed. Date: 2026-09-14.

## Context

The separate web and API applications need a typed, documented boundary that remains synchronized without importing backend implementation details into the browser.

## Decision

- Expose REST under `/api/v1` and maintain OpenAPI from API DTOs and endpoint definitions.
- Generate `packages/api-client` deterministically from the exported schema.
- Keep generated types/client independent of Prisma and domain internals.
- Add a contract drift check to CI once generation exists.
- Represent money and dates as defined in ADR 003.
- Use bounded pagination, documented sort/filter fields, and stable opaque identifiers for growing collections.
- Use explicit preview endpoints for authoritative financial previews.

Proposed error envelope:

```json
{
  "error": {
    "code": "PLAN_VERSION_CONFLICT",
    "requestId": "opaque-request-id",
    "fields": []
  }
}
```

Field errors contain a machine-readable field path, code, and safe interpolation parameters. API error codes are English stable identifiers, not translated sentences. The frontend maps codes to localized resources, with a generic fallback for unknown codes. Internal diagnostics stay in sanitized server logs.

Use HTTP 401 for missing/invalid authentication, 403 for forbidden actions, 404 for absent resources, 409 for state/version conflicts, and 422 for validly parsed input violating field/domain rules. Malformed request syntax uses 400. Final endpoint specs must document exact responses.

## Consequences

- Contract changes update schema, generated client, tests, and consumers together.
- Generated output must never be manually patched.
- Unknown errors remain displayable without exposing internal text.
- Request-body version fields on mutations can protect against stale writes; these are not a substitute for database constraints.

## Alternatives considered

Handwritten shared interfaces lack runtime contract evidence. GraphQL and RPC are possible but offer no clear benefit over the accepted REST direction for this application.

## Follow-up

Phase 2 selects `openapi-typescript` 7.13.0 and `openapi-fetch` 0.17.0. `pnpm build` compiles the API, exports `apps/api/openapi.json`, generates `packages/api-client/src/schema.gen.d.ts`, builds the client, and compiles the web application. Generated artifacts are ignored by Git and recreated in CI; there is no manually maintained response type or committed generated artifact to drift. `pnpm contract:check` compares regenerated schema/client bytes against the build's outputs to detect nondeterminism. Consumer type checks establish contract compatibility.

Only system health endpoints exist in phase 2 and expose no financial data. Implement authentication before financial endpoints in phase 3. Authenticate and validate future financial previews like normal financial reads.
