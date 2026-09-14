# Commitments and Provisions

Status: draft. Delivery: phase 4. D-01–D-03, D-07, D-09, and D-13 affect scheduling and provisions.

## Purpose and scope

Represent recurring financial commitments without requiring everyday expense entry. Support monthly charges and monthly provisions for annual obligations while displaying their real due-payment schedule separately.

## Conceptual data

| Record | Fields |
| --- | --- |
| Commitment | `id`, session-derived `userId`, `name`, `kind`, `version`, optional specialized-source link |
| Revision | Revision ID, `effectiveFromMonth`, `startsOn`, optional `endsOn`, amount, currency, frequency, destination, payment-method metadata |
| Due schedule | Monthly due day or explicit annual installment month/day/amount records |
| Planning projection | Source/revision IDs, month, charge kind, exact monthly charge, due payments, destination |

Initial kinds: fixed expense, subscription, professional expense, shared contribution, financing payment, and planned investment. Financing/investment modules may own additional metadata while using one canonical source for the planning projection.

Initial frequency is monthly or annual. Annual payment installments do not change the obligation into multiple separate annual expenses. Other frequencies require a deliberate spec extension.

## Rules

1. An amount is nonnegative exact EUR cents. A zero amount is valid, for example a temporarily zero professional fee; it is not automatically archived.
2. Require `startsOn`; if present, `endsOn` is inclusive and cannot precede it.
3. Select the unique latest revision whose `effectiveFromMonth` is not later than the requested month. Do not select two revisions for the same source/month.
4. Under D-03, include the selected revision when its active interval overlaps the month, applying a full monthly charge without daily proration.
5. A monthly commitment contributes its monthly amount exactly once.
6. An annual obligation contributes a monthly provision under D-01. Each full-cycle provision series conserves the obligation's annual total exactly.
7. Due payments are separate informational cash requirements. They do not create a second availability deduction if the obligation is already provisioned.
8. Require explicit installment amounts when the source does not provide them. Sum of installments must equal the annual obligation amount.
9. Proposed D-13: month/day schedules clamp to the final valid day when that day does not exist, including February 29 in non-leap years. This does not imply moving weekend/holiday dates.
10. Under D-09, do not infer that historical provisions were deposited or that the owner has sufficient reserve to pay a due bill.
11. Future revisions and archiving preserve existing monthly snapshots and original source provenance.
12. A financing or investment planning source cannot simultaneously be duplicated as a generic commitment for the same obligation.

## Provision examples

### Full-year annual obligation

Under D-01, EUR 100.00 distributed over January–December produces EUR 8.34 in January–April and EUR 8.33 in May–December. Total: EUR 100.00.

### Annual obligation paid in installments

An annual obligation of EUR 120.00, paid as EUR 40.00 in May and EUR 80.00 in November, contributes EUR 10.00 of monthly planning provision throughout a full active cycle. November shows both the EUR 10.00 provision and the EUR 80.00 due payment, but availability is reduced by EUR 10.00 for this source.

### Mid-cycle start

An annual EUR 120.00 obligation first included in October contributes EUR 10.00 in each remaining active month under proposed D-02. Do not claim those EUR 30.00 fund a EUR 120.00 November bill. Show the payment requirement and the absence of verified reserve information. Catch-up or opening funding requires explicit inputs and approved rules.

## Use cases

- Add a recurring item with a destination and active dates.
- Configure annual amount and explicit installment dates/amounts.
- Preview a future revision's effect on a selected month.
- End a source after its final active month without deleting history.
- Expose planning-charge and due-payment projections to planning through an application interface.

## Proposed HTTP surface

| Method / path | Purpose |
| --- | --- |
| `GET /api/v1/commitments` | List by kind, active month, and destination |
| `POST /api/v1/commitments` | Create source and first revision |
| `GET /api/v1/commitments/{id}` | Read configuration and revision history |
| `POST /api/v1/commitments/{id}/revisions` | Add a reviewed effective revision |
| `POST /api/v1/commitments/{id}/archive` | End future applicability with expected version |
| `POST /api/v1/commitments/preview` | Calculate charge and due-payment projections without saving |

## Errors

`COMMITMENT_NOT_FOUND`, `COMMITMENT_VERSION_CONFLICT`, `INVALID_EFFECTIVE_PERIOD`, `INVALID_DUE_SCHEDULE`, `INSTALLMENT_TOTAL_MISMATCH`, `DUPLICATE_PLANNING_SOURCE`, `DESTINATION_UNAVAILABLE`, `UNSUPPORTED_FREQUENCY`.

## UI behavior

- Default list: name, kind, monthly planning impact, frequency, destination, next due date, and validity.
- Detail form separates the obligation amount from its installment schedule and monthly provision.
- Explain the selected month's impact using the API preview; avoid labeling a EUR 10 provision as a EUR 120 monthly expense.
- Advanced schedule inputs appear when annual frequency is selected.
- Show zero, future, and ended items with text status rather than ambiguous color-only treatment.
- Display source revision dates and the month affected by an edit.
- Initial empty state offers a first commitment and a concise explanation of monthly versus annual planning.

## Acceptance examples

- A monthly EUR 50 subscription adds EUR 50 once to an active month's charges.
- EUR 100.00 annual provisions conserve 10,000 cents over the full cycle under D-01.
- EUR 120.00 in installments of EUR 40.00 and EUR 80.00 is valid; EUR 40.00 and EUR 70.00 is rejected atomically.
- A future October source is absent from September under D-03.
- A day-31 monthly payment falls on February's last day under D-13.
- A new October revision does not change an already closed September amount.
- Linking a phase-6 financing record to an existing planning source preserves one monthly charge.
- Entering two due dates without split amounts requires explicit installment amounts, not an automatic 50/50 assumption.

## Open decisions

Confirm provision distribution, starting mid-cycle, month validity, explicit installment treatment, reserve-tracking depth, and missing-day behavior. The full-cycle conservation guarantee does not imply that a partial active year accumulates the full annual amount.
