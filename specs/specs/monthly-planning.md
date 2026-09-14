# Monthly Planning and Allocation

Status: draft. Delivery: phase 5. D-01–D-06, D-09, and D-11 affect the central financial behavior.

## Purpose

Give the owner an understandable monthly plan: expected income, commitments, provisions, planned investment, availability, and account distribution. Provide explicit history rather than a continuously changing dashboard over today's source configuration.

## Conceptual data

| Record | Required information |
| --- | --- |
| Plan identity | Owner, `month`, ID, current revision ID |
| Plan revision | Revision number, state, expected version, calculation-policy version, creation/close timestamps |
| Income snapshot | Source/revision, description, expected cash, reserve, spendable income, component breakdown |
| Charge snapshot | Source/revision, description, classification, exact charge, destination, original calculated amount |
| Due-payment snapshot | Source/revision, date, exact amount, provision linkage; separate from planning charges |
| Override | Stable source/line reference, override amount, reason, original amount, audit metadata |
| Allocation | Destination snapshot, exact amount, purpose, linked funding lines, explicit residual role if any |
| Lifecycle event | Actor, action, affected revision, timestamp, reason, prior/new version |

## Core equations

```text
expectedCash = sum(income.expectedCash)
taxReserve = sum(income.taxReserve)
spendableIncome = expectedCash - taxReserve
planningCharges = monthlyCosts + annualProvisions + plannedInvestment
plannedAvailability = spendableIncome - planningCharges
unallocatedCash = expectedCash - sum(exclusiveDestinationAllocations)
```

Financing payments and shared contributions are included in monthly costs, not separate additional deductions. Due payments for provisioned obligations do not re-enter planning charges. Account group subtotals are presentation values and are not summed again with their space allocations.

Planned availability is not a current account balance. Allocating it to everyday spending does not change it. Show how that availability is assigned separately from the calculation of the available amount.

## Generation

1. Validate the planning month and authenticated owner.
2. If a plan identity already exists, return the current saved plan without replacing overrides or state.
3. Read effective income, commitments, destinations, and relevant policy versions in a consistent database transaction.
4. Reject invalid required source configuration with actionable codes. Empty configuration is a valid empty draft with zero totals, not a database error.
5. Calculate exact projections and snapshots.
6. Persist identity, first draft revision, snapshots, and audit event atomically.
7. Enforce unique owner/month identity; concurrent creation resolves to one plan.

Generation does not record receipts, bank transfers, investment executions, or reserve balances.

## Draft editing and refresh

- An override is explicitly monthly; it does not edit the source's recurring amount.
- Require expected version and a reason for a financial override.
- Recompute derived totals and dependent residual allocation after an accepted override using the domain calculator.
- A refresh preview compares current source revisions with snapshotted revisions without writing.
- Applying refresh requires the version associated with that preview. If inputs changed since preview, return a conflict and require another preview.
- Preserve overrides with stable source identity. A removed/invalid source or changed line meaning produces an explicit conflict; do not drop the override silently.
- Capture accepted refresh and override changes transactionally with their audit metadata.

## Allocation rules

1. Allocation distributes **expected cash**, including tax reserve, not just spendable income.
2. Propose destinations from source configuration, but persist owner-reviewed allocation lines.
3. Distinguish funded commitments, tax reserve, everyday spending, and remaining money.
4. Allow at most one automatic residual destination: `expectedCash - fixedAllocations`. If negative, flag over-allocation; do not silently save a negative transfer.
5. Drafts can be incomplete; show unallocated or overallocated cash explicitly.
6. Closing requires exact cash allocation reconciliation under proposed D-11. An account group must not count both a rollup and its components.
7. A negative-availability plan can be underfunded even when expected cash has been fully allocated. Explain funding gaps; do not invent borrowing or negative account transfers to conceal them.
8. Under D-11, closing an underfunded plan requires explicit acknowledgement. Full funding of all planning charges is not implied by allocation reconciliation.
9. Never mark an instruction as bank-executed solely because the plan was closed.

## Lifecycle

| Action | Preconditions | Result |
| --- | --- | --- |
| Generate | Valid month; no existing identity | Draft revision; otherwise returns existing current plan |
| Override / refresh / allocate | Current draft; expected version | New draft version with audited changes |
| Close | Current draft; expected version; valid sources/destinations; allocations reconcile; required shortfall acknowledgement | Immutable closed revision and event |
| Reopen | Current closed revision; expected version; reason | New draft revision cloned from closed state; original retained |
| Read historical revision | Authenticated owner and existing revision | Exact saved snapshot; no recomputation |

All mutating lifecycle steps are transactional. Two simultaneous close requests must not create two close events or lose an edit. No implicit month closing at midnight or month rollover.

## Proposed HTTP surface

| Method / path | Purpose |
| --- | --- |
| `POST /api/v1/monthly-plans` | Generate or return existing plan for a month |
| `GET /api/v1/monthly-plans?month=YYYY-MM` | Read current saved revision |
| `GET /api/v1/monthly-plans/{id}/revisions` | List saved revision history |
| `GET /api/v1/monthly-plans/{id}/revisions/{revision}` | Read a historical snapshot |
| `POST /api/v1/monthly-plans/{id}/refresh-preview` | Compare current sources with a draft |
| `POST /api/v1/monthly-plans/{id}/refresh` | Apply the reviewed refresh with version/input checks |
| `PUT /api/v1/monthly-plans/{id}/overrides/{lineId}` | Set an explicit monthly override |
| `PUT /api/v1/monthly-plans/{id}/allocations` | Replace the reviewed exclusive allocation set atomically |
| `POST /api/v1/monthly-plans/{id}/close` | Close with expected version and required acknowledgement |
| `POST /api/v1/monthly-plans/{id}/reopen` | Create a new draft revision with reason |

Removing an override is an explicit restoration to its source-calculated amount; specify its HTTP operation when implementing the override editor. Every read/update refers unambiguously to the current or requested revision.

## Errors

`INVALID_PLANNING_MONTH`, `PLAN_NOT_FOUND`, `PLAN_READ_ONLY`, `PLAN_VERSION_CONFLICT`, `PLAN_REFRESH_CONFLICT`, `INVALID_PLANNING_SOURCE`, `INVALID_ALLOCATION_DESTINATION`, `ALLOCATION_MISMATCH`, `NEGATIVE_ALLOCATION`, `SHORTFALL_ACKNOWLEDGEMENT_REQUIRED`, `REOPEN_REASON_REQUIRED`.

## UI behavior

- Overview prioritizes month, state, planned availability, and its explanation.
- Secondary sections distinguish spending commitments, investment, provisions, due payments, and allocation status.
- The primary action follows state: prepare absent month; review allocation/close draft; view revision or reopen closed month.
- A closed month displays a persistent read-only label and omits ordinary edit controls.
- Negative availability has a textual shortfall explanation and actionable breakdown; zero is distinct from missing data.
- Version conflicts preserve unsaved user input where practical and offer an explicit reload/review path.
- Loading and errors do not render fabricated zero totals. Stale cached results must be labeled if displayed during a failed refresh.
- No trend chart implies historical records where none exist.

See [screen flows](../design/screen-flows.md) for navigation, layouts, and responsive behavior.

## Acceptance examples

### Simple month

Income EUR 2,000.00, monthly costs EUR 800.00, provisions EUR 100.00, and planned investment EUR 200.00 produce availability EUR 900.00. Allocate EUR 800.00 for costs, EUR 100.00 for provisions, EUR 200.00 for investment, EUR 600.00 for everyday spending, and EUR 300.00 to remain in the main account. Unallocated cash is zero; availability remains EUR 900.00.

### VAT receipt

The income spec's professional entry produces EUR 960.00 expected cash and EUR 750.00 spendable income. With no planning charges, availability is EUR 750.00. Allocating EUR 210.00 to taxes and EUR 750.00 elsewhere leaves zero unallocated cash.

### Negative availability

Income EUR 1,000.00 and charges EUR 1,200.00 produce a EUR 200.00 shortfall. Allocating the available EUR 1,000.00 does not eliminate that shortfall. Closing requires the D-11 acknowledgement; no negative or fictional funding transfer is generated.

### History and concurrency

- Generating the same month twice returns the saved plan without replacing overrides.
- Two concurrent generate requests result in one identity and one first revision.
- Changing a subscription after close leaves the historical amount and label unchanged.
- Refresh preserves an override when its source remains valid; a removed source creates a reviewable conflict.
- Closing with a stale version fails atomically.
- Reopening creates a new editable revision, while the prior closed snapshot remains accessible.
- A failed snapshot write leaves no half-created plan or unmatched lifecycle event.

## Open decisions

Resolve D-05/D-06/D-11 before final lifecycle and allocation implementation. Source policy decisions are inherited from income and commitments. The workbook's cached monthly total is not an approved month-specific fixture until its effective dates and cent policy are agreed.
