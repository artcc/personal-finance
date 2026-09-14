# Domain Glossary

Use these terms consistently in code, API contracts, specifications, and design. Spanish UI labels belong in translation resources.

| Term | Meaning |
| --- | --- |
| Owner | The single authenticated person using this installation. |
| Account | A bank account used as a destination or source of planned money allocation. It is not a synchronized bank ledger. |
| Space | A budgeting subdivision of an account. A space has exactly one parent account. |
| Income source | Configuration describing expected salary or professional income. |
| Income entry | An expected income amount for a selected month, with its calculation components. |
| Expected cash receipt | The amount expected to arrive in an account after withholding and deducted commission, including collected VAT. |
| Tax reserve | Money excluded from spendable income and assigned for a future tax obligation; initially collected VAT under the proposed model. |
| Spendable income | Expected cash receipts less the applicable tax reserve. This is the income basis for planned availability. |
| Commitment | A planned financial obligation with a kind, amount, timing, and funding destination. |
| Commitment revision | An effective-dated version of a commitment, preserving earlier configuration. |
| Provision | A monthly planning charge reserving money for a non-monthly obligation. It is distinct from the eventual payment. |
| Due payment | A scheduled cash outflow on a calendar date, which may already be funded by provisions. |
| Installment | One scheduled part of an obligation's total payment amount. |
| Investment plan | Configuration for expected contributions. It affects planning without proving execution. |
| Actual contribution | A recorded contribution with its own date and amount; never inferred from elapsed months. |
| Monthly plan | A saved view of the income, obligations, provisions, investment allocations, and account allocations for a month. |
| Plan line | A snapshotted monthly amount, source reference, classification, and calculation provenance. |
| Monthly override | An explicit modification applying only to a saved draft month. |
| Planned availability | Spendable income minus monthly planning charges. It is not a live bank balance. |
| Allocation | An assignment of expected money to a destination; it does not create another expense. |
| Transfer instruction | A planned movement between accounts or spaces. The application does not execute bank transfers. |
| Unallocated cash | Expected cash receipts less destination allocations. This differs from planned availability. |
| Everyday spending allocation | The monthly amount assigned to the owner's dedicated spending account, without individual purchase tracking. |
| Draft month | An editable monthly plan. Source configuration changes do not silently regenerate it. |
| Closed month | A preserved plan revision whose saved figures are immutable. |
| Reopening | A proposed explicit action creating an editable revision while preserving the closed revision and its audit event. |
| Snapshot | Persisted calculation inputs, source labels, amounts, and results used to preserve a historical plan. |
| Carry-forward | A reserve amount transferred from one month's planning state to another; policy is not yet agreed. |
| Reported debt | A balance entered by the owner with an as-of date; explicitly distinguished from original principal or the sum of future installments. |
| Cost basis | Acquisition cost assigned to holdings or sold units using an explicitly chosen method. |
| Realized result | Net sale proceeds less the cost basis of units actually sold. |
| Valuation | An estimated position value at a specific date; independent of realized results. |

## Naming safeguards

- Do not name planned availability `balance`: it is neither observed cash nor net worth.
- Do not name a provision `payment`: the due month and funding months can differ.
- Do not name an allocation `expense`: the same money would be counted twice.
- Do not name collected VAT `spendable income`.
- Do not name a planned contribution `transaction` unless execution has been recorded.
