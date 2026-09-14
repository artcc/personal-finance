# Spreadsheet Mapping and Reference Figures

Inspection date: 2026-09-14.

Scope update: the owner has excluded data import and will enter data manually. This document preserves the historical analysis, not an importer specification. The original workbook may be removed; neither development nor application operation depends on it.

## Inspection scope

The local Excel export was read through its ZIP/XML structure using the Python standard library, without installing dependencies or changing the workbook. It contains **7 worksheets and 100 formula cells**. Cell references below refer to the existing export. Worksheet labels in this document are English descriptions of the original worksheets, in workbook order.

Formula expressions and cached results were inspected. Excel/Numbers formulas were not recalculated, the original Numbers document was not compared visually, and no application tests or validators were run. Cached amounts are evidence of the exported state, not proof of current balances or current-month applicability.

## Worksheet-to-module mapping

| # | Worksheet description | Source cells / regions | Target |
| --- | --- | --- | --- |
| 1 | Cryptocurrency savings | `A3:J6`, `K12:T18`; totals `F8`, `P20` | Investment products, platforms, opening positions or identifiable purchase records |
| 2 | Investment savings | `A3:G5`, `J14:P16`, `Q20:W22` | Investment plans, explicitly reported opening contributions, later actual contributions |
| 3 | Financing | `A3:C5`, `D9:F11`, `G15:K19` | Financing agreements and linked monthly commitment sources |
| 4 | Fixed and unavoidable expenses | `A3:B10`, `C14:D20` | Monthly commitments, annual obligations, due-payment schedules |
| 5 | Professional expenses | `A3:B5` | Professional commitments |
| 6 | Income and monthly availability | `B3:C9`, `D13:E19`, `G23:G34`, `H38:O40`, `R49:Z51`, `Q44:Q45` | Salary metadata, income entries, planning, allocations, tax components |
| 7 | Service subscriptions | `A3:B9`, `C13:D18`, `E22:F24`, `G28:H30` | Subscription commitments and payment-method metadata |

## Reference monthly arithmetic

Worksheet 6 links totals from worksheets 2–5 and 7.

| Item | Source | Cached amount (EUR) |
| --- | --- | ---: |
| Monthly net income | Worksheet 6, `G23` | 3,160.00 |
| Mortgage | Worksheet 6, `G25` | 578.00 |
| Shared-cost contribution | Worksheet 6, `G26` | 280.00 |
| Monthly fixed expenses | Worksheet 6, `G27` | 240.00 |
| Planned savings and investment | Worksheet 6, `G28` | 500.00 |
| Annual expense provision | Worksheet 6, `G29` | 1,319 / 12 |
| Monthly subscriptions | Worksheet 6, `G30` | 45.50 |
| Annual subscription provision | Worksheet 6, `G31` | 188 / 12 |
| Professional expenses | Worksheet 6, `G32` | 0.00 |
| Personal loan | Worksheet 6, `G33` | 267.00 |
| Other financing | Worksheet 6, `G34` | 0.00 |
| Total planning charges | Worksheet 6, `Q44` | 2,036.083333333330 |
| Planned availability | Worksheet 6, `Q45` | 1,123.916666666670 |

At two displayed decimal places, the last two results are **EUR 2,036.08** and **EUR 1,123.92**. They are reference arithmetic for this exported configuration, not yet a dated acceptance fixture. Effective-date rules and per-obligation cent allocation can intentionally produce different monthly figures.

The EUR 500 investment allocation consists of EUR 375 for a fund and EUR 125 for a pension plan. The fund's start date is 2026-10-01, but its configured monthly contribution is already included in the reference total. Do not silently label the cached total as September 2026.

## Reference allocation model

Worksheet 6 currently assigns money as follows:

| Destination role | Source | Cached amount (EUR) |
| --- | --- | ---: |
| Main account remainder | `E13` | 1,828.916666666670 |
| Online spending space | `E14` | 45.50 |
| Tax space | `E15` | 0.00 |
| Bills space | `E16` | 125.583333333334 |
| Secondary account | `E18` | 880.00 |
| Shared-cost account | `E19` | 280.00 |

These assignments distribute income; they are not additional planning charges. In particular:

- The secondary account combines mortgage EUR 578, insurance EUR 35, and loan EUR 267.
- The EUR 35 insurance is already included in monthly fixed expenses.
- The shared-cost transfer corresponds to the existing EUR 280 charge.
- The main account remainder funds multiple uses; it is not equal to planned availability.
- The dedicated everyday spending allocation is confirmed by the owner, but its amount is not explicitly specified by the workbook.

## Income interpretation

Salary information includes annual gross salary, extras, a possible variable percentage, and an independently entered monthly net salary. The app must not infer net salary from gross salary.

The direct-client row contains several manually entered zero values rather than a complete calculation chain. It does not establish a universal invoicing formula.

The platform-income row has explicit formulas:

```text
base = hourlyRate × hours
vat = base × 0.21
commission = base × 0.10
withholding = base × 0.15
cashReceipt = base + vat - withholding - commission
spendableIncome = cashReceipt - vat
```

The workbook adds spendable professional income to monthly income, then subtracts the VAT allocation again when calculating the main-account allocation remainder. With nonzero professional income, those two calculations use different cash bases. The export has zero professional income, so it does not demonstrate the intended behavior. See D-04 in the [decision register](../decisions.md).

## Observed formula limitations

### Unsold cryptocurrency positions

Worksheet 1 calculates sale proceeds minus purchase cost even when the sale field is blank. A blank behaves as zero in the subtraction, creating an apparent loss of the entire acquisition amount. This is the root cause of the negative displayed totals for unsold positions.

Application behavior must separate invested cost, realized sale results, and valuation. Empty sale fields do not represent a sale. Aggregated or transferred holdings require explicit manual opening records rather than invented execution history.

### Estimated recurring contributions

Worksheet 2 multiplies elapsed calendar months, including the start month, by the current monthly amount. It assumes every contribution occurred and that the contribution amount never changed. For sufficiently distant future start dates, the expression can also become negative because it is not clamped at zero.

These estimates must not become actual transactions. Any manually entered opening amount must be clearly labeled and carry an as-of date. Planning must honor agreed effective dates.

### Annual provisions and precision

Annual fixed expenses total EUR 1,319. Annual subscriptions total EUR 188. The workbook divides category totals by 12 and retains fractional cents. The application needs an explicit cent-allocation policy and a decision about starting mid-cycle; see D-01 and D-02.

### Financing and embedded metadata

The mortgage and loan columns are labeled as totals; they do not prove whether the figures are original principal or outstanding principal. Another financing section estimates remaining debt as installment amount times remaining installments, which may include interest.

Account references, due days, end dates, and installment dates are embedded in descriptions. Extracting them requires a reviewed mapping. Annual installment amounts must not be assumed equal simply because the number of dates is known.

## Reference boundaries

- Worksheet indices and cell/range references here explain the historical analysis; they do not require runtime source-file storage.
- Enter configuration and financial records manually through the application.
- Preserve user-entered labels; project-authored descriptions remain English.
- Do not invent contribution dates, sale records, current bank balances, or missing payment splits.
- Do not interpret spreadsheet formulas as executable application code.
- Separate cached-reference comparisons from approved-rule acceptance fixtures.
- No import preview, commit, mapping engine, or duplicate-import handling is planned. Removing the workbook does not remove a development prerequisite.
