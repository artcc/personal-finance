# Compatible Financial JSON Export and Import

Status: implementation present; current functional verification pending in CI. The owner explicitly requested JSON export/import only and excluded backup tooling and deployment actions from this task.

## User workflow

1. Open `/settings/data` and download the current user's financial JSON file.
2. Select an application-generated JSON file in an empty financial workspace.
3. Review its compatibility, models, relationships, and record counts.
4. Explicitly confirm import. All records are inserted in one transaction, or none are.

There is no spreadsheet/CSV import, data merge, overwrite, credential restore, or public file-hosting step. Authentication accounts remain independent from imported financial records.

## Version-1 document

The exact file schema lives in `apps/api/src/modules/data-portability/application/document.ts`.

- `format`: `personal-finance`.
- `formatVersion`: `1`.
- `exportedAt`: UTC ISO timestamp.
- `currency`: `EUR`.
- `moneyEncoding`: `integer-cents-as-strings`.
- `data`: all 15 required collection arrays, even when empty.

Collections: accounts, spaces, income sources/revisions, commitment sources/revisions/installments, financings/debt reports, investments/entries/valuations, monthly plans/revisions, and financial audit events.

Financial money columns retain their `Cents` suffix and are decimal integer strings. Nested source and monthly snapshots retain their Money objects. Quantities/rates are exact plain decimal strings. Calendar dates use `YYYY-MM-DD`; audit timestamps remain UTC ISO timestamps. No binary floating-point conversion is used for money.

Passwords, credentials, session tokens, CSRF tokens, and authentication tables are excluded by explicit export column selection. User ownership columns are not accepted as import authority.

## Validation and identity

- Require the supported format/version and all collections. Reject unknown fields and implicit schema normalization instead of silently dropping data.
- Validate identifier uniqueness, foreign-key relationships, ownership within the file, source versions, planning links, installment totals, exact income calculations, investment movement history, and stored monthly summaries.
- Closed imported plans must have a closing timestamp and reconciled allocations. The import does not certify the authenticity of a file; it validates its compatibility and financial consistency.
- Generate new identifiers for imported rows and rewrite structural relationships, including plan line/override/allocation references. Do not rewrite user-entered names or notes.
- Preserve original financial values, timestamps, historical versions, and void/correction information. Original source fingerprints remain provenance; future plan refreshes compute fresh fingerprints in the destination workspace.
- Validate the complete document before mutation. Under the existing per-user financial write lock, recheck that the destination remains empty and insert all collections transactionally.
- A preview fingerprint binds confirmation to the reviewed file. An existing workspace or changed file is rejected; no merge or deletion is attempted.
- Add one import audit event containing format, source export timestamp, document fingerprint, and counts. Imported historical events retain their recorded dates and remapped references.

## Endpoints and bounds

- `GET /api/v1/data/export`: authenticated JSON attachment, `Cache-Control: no-store`.
- `POST /api/v1/data/import-preview`: authenticated, same-origin/CSRF-protected validation with counts and empty-workspace status; no writes.
- `POST /api/v1/data/import`: authenticated, same-origin/CSRF-protected atomic import of the reviewed document.

Files are limited to 32 MiB and 50,000 total financial rows. Oversized data is rejected rather than truncated. The import transaction has a bounded 60-second timeout; other financial writes retain their existing timeout. No server-side export files, upload archive, or background worker is created.

## Acceptance evidence to obtain in CI

- Export/import round-trip preserves exact amounts and closed-month summaries.
- Authentication data and other users' financial data never appear in an export.
- Imported identities are fresh, private to the destination user, and internally consistent.
- Unknown versions, malformed relationships, altered computed totals, changed previews, and nonempty destinations are rejected.
- A failure while inserting a later collection rolls back earlier collections.
- Browser download, file review, confirmation, and resulting account access work on desktop/mobile.

Only owner-authorized format/lint checks run locally. No test or runtime success is implied by this specification.
