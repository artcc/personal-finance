# ADR 003 — Exact Money and Calendar Semantics

Status: exact arithmetic accepted; representations and rounding policies proposed. Date: 2026-09-14.

## Context

The workbook retains fractional cents when dividing annual totals and uses calendar-month formulas for investments. JavaScript binary floating-point arithmetic and localized date strings must not become financial storage formats.

## Decision

- Initial planning currency is EUR.
- Represent posted/planned monetary amounts as integer cents in the domain and PostgreSQL `BIGINT` storage.
- Use `bigint` or an equivalent exact representation in domain calculations. Do not convert wire money to JavaScript `number` for arithmetic.
- Use an API money object such as `{"currency":"EUR","minorUnits":"316000"}`. Minor units are a canonical signed integer string, avoiding JSON `bigint` and safe-integer limitations.
- Use exact decimal strings for quantities, prices, and rates and PostgreSQL `NUMERIC` for persistence. Precision/scale limits must be specified per field before its migration/API is implemented; reject excess precision instead of silently truncating it.
- Percentage rates use a documented decimal fraction, for example `"0.21"`, not a locale-formatted percentage.
- Investment calculations use exact intermediate arithmetic and only round at explicitly defined monetary boundaries.

## Proposed rounding policy

For an annual obligation of `A` nonnegative cents over 12 calendar months:

```text
base = floor(A / 12)
remainder = A mod 12
monthlyShare = base + 1 for the first remainder months of the cycle
monthlyShare = base for the remaining months
```

Example: EUR 100.00 gives four months of EUR 8.34 and eight of EUR 8.33, totaling exactly EUR 100.00. For a full cycle, the obligation's shares must sum to its total.

Apply this per obligation before aggregation. A category subtotal can therefore differ from rounding a spreadsheet category's annual total divided by 12. Partial active cycles and mid-cycle price changes do not invent retroactive charges; D-02/D-03 govern their treatment.

Computed tax components use half-away-from-zero rounding to cents under proposed D-12. Input amounts are validated, not silently rounded. Credits/refunds and negative obligations require a separately specified model; initial commitment amounts are nonnegative.

## Dates and time

- Use `YYYY-MM` for a planning month and validate that it is a real month.
- Use `YYYY-MM-DD` / SQL `DATE` for effective dates and due dates.
- Use UTC timestamps / `TIMESTAMPTZ` for audit and session events.
- Resolve the current planning month using a configured owner time zone, initially proposed as `Europe/Madrid`.
- Proposed validity: inclusive date overlap with a month causes a full monthly planning charge; no implicit daily proration. A due payment still follows its own schedule.
- Clamp a configured due day to the last valid day of a short month, subject to schedule-policy approval in the commitments spec.
- Do not parse locale-formatted strings or convert calendar dates through UTC-midnight timestamps in the domain.
- Inject a clock into time-dependent use cases; historic reads use saved inputs, not `today`.

## Alternatives considered

- Floating-point currency: rejected because aggregation and equality become unreliable.
- Round each annual twelfth independently: rejected as the default because a full cycle can lose/gain cents.
- Fractional cents everywhere: closer to the spreadsheet but poorly aligned with transfer instructions.

## Consequences and follow-up

Frontend input parsing and display must preserve the exact wire value, including large amounts. Intl presentation must use an exact compatible path or an explicitly enforced bound; it must not introduce lossy `Number` conversion. Resolve D-01–D-03, D-12, E-02, numeric bounds, and due-day semantics before dependent implementation.
