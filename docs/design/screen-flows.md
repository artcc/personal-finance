# Screen Flows and Structural Wireframes

Status: draft interaction design. Wireframes use English illustrative labels for documentation; they are not frontend copy or completed visual mockups.

## Route proposal

| Route | Screen | Context |
| --- | --- | --- |
| `/login` | Authentication | No financial content before authentication |
| `/register` | User registration | Independent private workspace; no default credentials |
| `/settings/security` | Current account and sessions | User-scoped listing/revocation |
| `/planning/:month` | Monthly overview | Selected `YYYY-MM`, current saved plan revision |
| `/planning/:month/allocation` | Allocation | Same month/revision context |
| `/planning/:month/history` | Revision history | View preserved snapshots |
| `/accounts` | Account/space configuration | Future destination availability |
| `/income` | Income configuration | Effective revisions and one-month entries |
| `/commitments` | Commitments list | Activity/kind/destination filters |
| `/commitments/new` | Create commitment | Authoritative financial preview |
| `/commitments/:id` | Commitment detail/edit | Explicit effective month |
| `/financing` | Financing | Introduced in phase 6 |
| `/investments` | Investments | Introduced in phase 6 |
| `/settings/data` | Data export | Introduced in phase 7 |

When monthly planning ships, invalid months must produce a localized invalid-route state rather than silently selecting another month, and the root can redirect to the current planning month. In phase 3, `/` is the private welcome screen; monthly financial routes remain design proposals.

## Flow 1 — First use

```text
Web registration
  -> Create an independent account and session
  -> Monthly overview: no saved plan
  -> Configure receiving account / optional spaces
  -> Add income
  -> Add monthly and annual commitments
  -> Return to selected month
  -> Prepare month
  -> Inspect calculation and allocation
```

The phase-3 shell currently shows a private welcome state and working session controls. Financial setup links become interactive as their modules ship; they do not pretend to create configuration in this phase. Registration/login preserve private account boundaries. Logout and expiry clear private query state; other tabs receive an access-change notification.

The [phase-3 visual proposal](phase-3-preview.html) provides responsive financial designs with synthetic fixtures for owner review. Those prototype controls do not store data or execute financial operations.

## Flow 2 — Routine monthly planning

```text
Open selected month
  -> Existing plan? Read saved plan : Prepare month
  -> Review income and charges
  -> Optional monthly override (reason required)
  -> Review allocation
  -> Resolve unallocated / overallocated money
  -> Review close summary
  -> Close month
  -> Read-only monthly overview
```

The close summary lists month, availability, allocation reconciliation, and any acknowledged shortfall. Closing is an explicit application action; it does not execute transfers or mark payments as observed.

## Flow 3 — Change a recurring commitment

```text
Commitment detail
  -> Edit future revision
  -> Select effective month
  -> Preview monthly charge and due-payment changes
  -> Save source revision
  -> Existing draft affected? Offer refresh preview
  -> Resolve override conflicts if present
  -> Apply refresh with version check
```

Changing a source never silently modifies a saved month. Closed plans remain unchanged. Show the distinction between editing the recurring source and overriding only the currently selected month.

## Flow 4 — Reopen a closed month

```text
Closed overview
  -> Reopen action
  -> Explanation of preserved history + reason input
  -> Confirm
  -> New draft revision
  -> Edit / allocate / close
  -> History includes original closed revision
```

Reopening behavior depends on D-05. Restore focus to the updated heading/state after navigation. Show which revision is current and which is historical.

## Flow 5 — Data conflict

```text
Editing from version N
  -> Another request changes source or plan
  -> Save receives conflict
  -> Retain local input where possible
  -> Explain changed version and offer reload/review
  -> Owner reapplies or discards local edit deliberately
```

Never automatically retry a stale financial mutation as an overwrite. Failed requests do not show a successful-save notification.

## Desktop overview wireframe

```text
+----------------------+------------------------------------------------------+
| Product identity     | Monthly overview                                     |
|                      | < October 2026 >   [Draft]             [Review plan] |
| Monthly overview     |                                                      |
| Allocation           | +--------------------------------------------------+ |
| Commitments          | | Planned availability                             | |
| Income               | | EUR 900.00                                       | |
| Accounts             | | After costs, provisions, and planned investment  | |
| Financing            | | View calculation                                 | |
| Investments          | +--------------------------------------------------+ |
|                      |                                                      |
|                      | Income       Costs      Provisions     Investment    |
|                      | EUR 2,000    EUR 800    EUR 100        EUR 200       |
|                      |                                                      |
|                      | +----------------------------+ +-------------------+ |
|                      | | This month's commitments   | | Allocation        | |
|                      | | Grouped items + source link| | Remaining amount  | |
|                      | | Monthly planning impact    | | Destination groups| |
|                      | +----------------------------+ | [Review allocation]| |
|                      | +----------------------------+ +-------------------+ |
| Settings             | | Upcoming due payments      |                       |
| Session              | | Date / item / amount       |                       |
+----------------------+------------------------------------------------------+
```

Values above are synthetic examples aligned with the monthly-planning spec. The upcoming payments section is distinct from planning charges so a provisioned annual payment is not visually presented as another availability deduction.

## Mobile overview wireframe

```text
+------------------------------------+
| [Menu]  Monthly overview            |
| < October 2026 >          [Draft]   |
|                                    |
| Planned availability               |
| EUR 900.00                         |
| After planned commitments          |
| View calculation                   |
|                                    |
| Income             EUR 2,000.00    |
| Costs                EUR 800.00    |
| Provisions           EUR 100.00    |
| Investment           EUR 200.00    |
|                                    |
| Allocation                         |
| Unallocated cash     EUR 300.00    |
| [Review allocation]                |
|                                    |
| Commitments                        |
| Name / kind / monthly impact       |
| ...                                |
|                                    |
| Upcoming payments                  |
| Date / item / payment amount       |
+------------------------------------+
```

Stack labels and amounts when width or text expansion requires it. The action remains reachable without fixed overlays obscuring form fields. Currency examples here describe meaning; actual rendering uses `es-ES` resources and Intl.

## Allocation wireframe

```text
Allocation — October 2026                       [Save allocation]

Expected cash: EUR 2,000.00     Unallocated: EUR 300.00

Main account                                  Group total: ...
  Direct account remainder                    [Not assigned yet]
  Bills space                                 [EUR 100.00]
  Investment allocation                       [EUR 200.00]

Payment account
  Monthly commitments                         [EUR 800.00]

Everyday spending account
  From planned availability                   [EUR 600.00]

Summary
  Fixed assignments: EUR 1,700.00
  Remaining to assign: EUR 300.00
  [Assign remainder to main account]
```

This is an incomplete editing state before the residual destination is applied. After the residual is assigned, fixed plus residual allocations equal EUR 2,000.00 and unallocated cash is zero. Do not display the residual as both automatic and still unallocated in the saved state.

On mobile, each account is a stacked group with full-width labeled inputs. Totals are read-only; direct account amounts are not confused with group rollups.

## Annual commitment editor wireframe

```text
New commitment

Identity
  Name                          [                            ]
  Kind                          [Fixed expense             v]
  Destination                   [Bills space               v]

Amount and validity
  Frequency                     [Annual                    v]
  Annual amount                 [EUR 120.00                  ]
  Starts on                     [2026-01-01                  ]
  Ends on                       [Optional                    ]
  Effective revision month      [2026-01                     ]

Payments
  May 20                        [EUR 40.00                   ]
  November 22                   [EUR 80.00                   ]
  [Add installment]
  Installment total: EUR 120.00 / EUR 120.00

API preview — selected month
  Monthly provision: EUR 10.00
  Due payment: shown separately for months with an installment
  Reserve sufficiency: not inferred from the plan

[Cancel]                                           [Save commitment]
```

Use a single-column form on mobile. Inline errors appear adjacent to amount, date, and schedule inputs. Recompute the preview when relevant input changes; identify a pending/outdated preview so the owner cannot mistake it for the new result.

## Screen/state coverage for visual review

| Screen | Desktop | Mobile | Additional states |
| --- | --- | --- | --- |
| Overview | Full layout | Stacked summary | Absent month, loading, empty draft, error, zero, shortfall, closed |
| Allocation | Account-group editor | Stacked inputs | Unallocated, overallocated, invalid destination, stale version |
| Commitment editor | Focused form + preview | Single-column form | Monthly, annual installments, preview failure, future revision |
| Authentication | Focused card | Full-width accessible form | Invalid login, expired session, loading |
| History | Revision list + detail | Stacked revisions | Original closed snapshot versus reopened draft |

## Handoff evidence

For each high-fidelity screen, record viewport, state, relevant translation keys, component variants, and linked acceptance criteria. For the implemented screen, capture corresponding browser evidence and review keyboard/focus behavior. None of these wireframes constitutes owner approval of the final visual style.
