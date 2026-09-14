# Investment Movements and Manual Valuations

Status: owner-approved simplified phase-6 scope implemented; runtime verification pending in CI. No FIFO, commissions, cost basis, or automatic realized profit.

## Instrument

An instrument has a name, optional platform/ticker, kind (fund, pension, cryptocurrency, or other), and accounting mode chosen at creation:

- **Contributions:** explicitly recorded contributions and withdrawals; no inferred unit balance.
- **Units:** explicitly recorded purchases and sales with exact quantities and total paid/received in EUR.

An optional monthly contribution plan links to one investment commitment. Create it atomically or reuse an existing unlinked source. Recording an actual movement does not create another commitment, change a monthly plan, or prove that a planned contribution happened.

## Movements

- A dated opening record may establish reported units and/or contributed capital before the recorded movement history. An unknown opening amount remains null and makes capital totals explicitly partial.
- Only one active opening record is allowed. It represents the start of its reported day and must precede the rest of the recorded history.
- Unit purchases and sales require positive quantities. A sale cannot exceed recorded units at its date. Quantities use exact eight-place arithmetic; dates and an operation's original ordering sequence define chronology.
- Contributions/withdrawals record positive EUR amounts. Withdrawals can exceed prior contributions, so cash-flow totals are not treated as cost basis or profit.
- Actual movements and reported valuations/debt cannot be future-dated; future intentions belong in planning sources.
- Corrections append a replacement and retain the original as voided with a reason. Voiding also requires a reason. The resulting complete active history must remain valid; no mutation may leave a later sale without sufficient recorded units.
- Every mutation is user-scoped, version-checked, and transactional with its audit event.

Corrections retain the original operation's ordering position for same-day balance checks while receiving a new audit sequence and identifier. A partial unique database index permits only one active entry at that position. This ordering checks unit availability; it does not allocate purchase lots or costs to sales.

## Valuations and presentation

Record total EUR value explicitly with an as-of date. Display the latest valuation and its date, never a live price. Warn when subsequent movements may make it stale. Do not sum valuations from different dates into an apparently current portfolio balance.

Display recorded inflows, recorded outflows, net recorded cash flow, and (for unit instruments) recorded units. Clearly label partial opening information. Neither net cash flow nor a manual valuation is labeled realized profit. Do not infer missing purchases, sales, contributions, fees, or exchange rates.

## Acceptance

- Plans and actual movements remain separate and never double-charge monthly availability.
- Sales/voids/corrections preserve nonnegative chronological unit balances.
- Unknown opening capital does not become an invented purchase or zero cost basis.
- Each user's instruments, movements, valuations, and source links remain private.
- Editing or recording investment data does not modify closed monthly snapshots.

## Implemented surface

- `GET/POST /api/v1/investments` and `GET/PATCH /api/v1/investments/{id}`.
- `GET/POST /api/v1/investments/{id}/entries`, plus explicit `.../entries/{entryId}/correct` and `.../entries/{entryId}/void` actions.
- `GET/POST /api/v1/investments/{id}/valuations` for dated manual reports.
- `/investments` lists the instruments; `/investments/:id` shows movements and valuation history. Tables adapt to stacked labeled records on mobile.
- Kind/platform/ticker are descriptive metadata. Recording mode and an established planning-source link cannot be reinterpreted by a metadata edit. A previously unplanned instrument can acquire one contribution-plan link.
- All quantities and reports reuse exact primitives and the current user's financial write lock. No dependency, external price service, or tax/cost-basis subsystem is added.
