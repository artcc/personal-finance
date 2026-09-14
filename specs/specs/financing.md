# Financing

Status: phase-6 implementation present; runtime verification pending in CI. Keep the experience close to a simple financial worksheet.

## Scope

- A financing record has a name, lender, optional original principal, and one monthly commitment.
- Create the commitment in the same transaction or link an existing, unlinked financing commitment belonging to the same user.
- Display payment configuration and effective dates from that canonical commitment. Do not create a second planning charge.
- Record remaining debt explicitly as an amount and calendar date. A newer report at the same date supersedes the displayed value without deleting the older report.
- Do not infer payments made, remaining installments, amortization, interest, or debt from elapsed time or the monthly plan.
- Edit payment dates/amounts through the existing commitment editor. Linking fixes the commitment category to financing. Archiving that commitment stops future planning; it does not prove repayment.

## Integrity

All records and links are user-scoped. Compound foreign keys and a unique planning-source link prevent cross-user references and duplicate associations. Metadata changes, balance reports, and linking use the existing per-user financial transaction lock and audit events. Expected versions reject stale edits. Closed monthly snapshots remain unchanged.

## UI

One financing list with direct create/edit and debt-report dialogs. Show the configured payment, the latest explicitly reported debt and its date, and the original principal separately. Missing debt is unknown, not zero. No amortization wizard or calculated paid-percentage chart is included.

## Acceptance

- Linking or creating a financing source produces one planning charge.
- A user cannot read or link another user's source/financing.
- A linked source cannot change to a non-financing category.
- Reporting debt does not alter payment configuration or closed plans.
- Later dates, followed by record version, determine the latest displayed report.

## Implemented surface

- `GET/POST /api/v1/financings`, `GET/PATCH /api/v1/financings/{id}`.
- `GET/POST /api/v1/financings/{id}/balances` for paginated reports and append-only updates.
- `/financing` is the list and direct entry screen; `/financing/:id` shows reported-debt history.
- Payment creation/linking and metadata use one financial transaction. A unique source association and same-user foreign key protect the link; linked commitments expose `managedKind` and reject incompatible category/frequency edits.
- Names/lenders use the existing 120-character convention. Currency remains EUR. Balance reports carry a monotonic sequence; no balance is inferred when none is reported.
