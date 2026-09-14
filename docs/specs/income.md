# Income

Status: draft. Delivery: phase 4. D-03, D-04, and D-12 are blocking financial policies.

## Purpose and scope

Provide explicit monthly expected income for planning, including salary and professional work. Separate cash expected to arrive from the portion available for commitments. The module does not calculate payroll tax, issue invoices, reconcile receipts, or file tax returns.

## Conceptual data

| Record | Fields |
| --- | --- |
| Income source | `id`, session-derived `userId`, `kind`, user-entered `name`, receiving destination, version |
| Income revision | Source ID, revision ID, `effectiveFromMonth`, `startsOn`, optional `endsOn`, typed calculation inputs |
| Salary inputs | Explicit monthly net amount; optional descriptive annual gross/extras/variable metadata |
| Professional inputs | Explicit base or exact hourly rate and hours; VAT/withholding/commission rates; deducted-commission mode |
| Monthly entry | Planning month, source revision, expected cash, VAT reserve, spendable amount, component breakdown |

Recurring sources can feed multiple months. Professional income can also be an explicit single-month entry. Marking a source as recurring is deliberate; a one-off invoice amount does not automatically recur.

## Rules

1. Monthly net salary is entered explicitly; annual gross metadata does not derive net salary.
2. An income source selects one effective revision per planning month, then applies D-03 calendar validity.
3. Initial income amounts, hours, and rates are nonnegative. Refunds/corrections require a separate approved model rather than negative salary inputs.
4. A professional entry uses either explicit base or rate-times-hours input, never both conflicting bases.
5. Rates are decimal fractions with field bounds defined in OpenAPI; zero VAT/withholding/commission is valid.
6. Exact base and tax/commission arithmetic is performed in the domain. Decimal precision and rounded-cent boundaries follow ADR 003 and D-12.
7. The initial commission scenario is a fee deducted from the same receipt and based on the pre-tax base. Other scenarios must be rejected or explicitly modeled, not guessed.
8. Withholding reduces the expected receipt. Do not subtract it again as a tax allocation from spendable income.
9. Collected VAT is present in expected cash, excluded once from spendable income, and can be funded into a tax space.
10. Editing the source cannot mutate saved monthly snapshots; refresh is a separate planning operation.

## Proposed calculation

```text
base = enteredBase OR roundMoney(exactHourlyRate × exactHours)
vat = roundMoney(base × vatRate)
withholding = roundMoney(base × withholdingRate)
commission = roundMoney(base × commissionRate)
expectedCash = base + vat - withholding - commission
taxReserve = vat
spendableIncome = expectedCash - taxReserve
```

`roundMoney` follows proposed D-12. Reject input combinations whose components yield a negative expected receipt under this initial model. All saved components are exact cents, and the saved receipt is formed from those components so the displayed equation reconciles.

### Illustrative professional-income example

With base EUR 1,000.00, VAT 21%, withholding 15%, and deducted commission 10%:

| Component | EUR |
| --- | ---: |
| Base | 1,000.00 |
| VAT | 210.00 |
| Withholding | 150.00 |
| Commission | 100.00 |
| Expected cash | 960.00 |
| Tax reserve | 210.00 |
| Spendable income | 750.00 |

An allocation of EUR 210 to taxes and EUR 750 to other destinations distributes EUR 960. It must not use EUR 750 as the cash allocation budget and then reserve EUR 210 again. This example illustrates D-04, not approved tax advice or a universal invoice rule.

## Use cases

- Create or revise recurring salary with a future effective month.
- Add a professional entry to one month and preview its component equation.
- Change future rates without changing previously generated months.
- Archive a source for future planning while retaining snapshots.
- Supply planning with a stable, exact income projection and source provenance.

## Proposed HTTP surface

| Method / path | Purpose |
| --- | --- |
| `GET /api/v1/income-sources` | List source configuration |
| `POST /api/v1/income-sources` | Create a recurring source |
| `POST /api/v1/income-sources/{id}/revisions` | Create an effective monthly revision |
| `POST /api/v1/income-sources/{id}/archive` | End future applicability explicitly |
| `POST /api/v1/income/preview` | Calculate without persistence |
| `POST /api/v1/income-entries` | Create a one-month entry |
| `PATCH /api/v1/income-entries/{id}` | Update an entry using expected version |
| `GET /api/v1/income-entries?month=YYYY-MM` | Read monthly source inputs, distinct from saved plan snapshots |

## Errors

`INCOME_SOURCE_NOT_FOUND`, `INCOME_VERSION_CONFLICT`, `INVALID_INCOME_PERIOD`, `CONFLICTING_BASE_INPUTS`, `INVALID_RATE`, `DECIMAL_PRECISION_EXCEEDED`, `INVALID_RECEIPT_AMOUNT`, `UNSUPPORTED_COMMISSION_MODE`, `DESTINATION_UNAVAILABLE`.

## UI behavior

- Show monthly net salary as the main input; annual gross metadata is secondary.
- Professional form exposes either explicit base or hours/rate, followed by an expandable tax/commission section.
- Preview separately displays expected cash, tax reserve, and spendable income, with a text explanation.
- Disable save while a required authoritative preview is invalid; do not show stale preview as current when inputs change.
- Preserve form contents on network errors. Localized validation appears beside fields and in an accessible summary where necessary.
- Label future changes with their effective month and explain that existing plans require explicit refresh.

## Acceptance examples

- Net salary EUR 3,160 produces EUR 3,160 expected cash and spendable income, with no tax reserve in the net-salary model.
- The EUR 1,000 professional example produces EUR 960 expected cash and EUR 750 spendable income under D-04/D-12.
- Setting all professional tax/commission rates to zero makes expected cash and spendable income equal to base.
- Under D-03, a source starting 2026-10-01 is absent from September and present in October.
- A revision effective in October leaves a saved September entry unchanged.
- An amount with unsupported precision is rejected rather than silently losing digits.
- A preview request writes no source, entry, or plan record.

## Open decisions

Confirm professional cash/tax treatment, commission scope, and rounding before implementing calculations. Actual receipt tracking, invoice management, and additional tax reserve categories are not implied by this spec.
