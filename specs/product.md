# Product Definition

Status: confirmed product direction; detailed policy proposals are tracked in the [decision register](decisions.md).

## Purpose and user

Personal Finance is a self-hosted application with web registration and independent user accounts. It replaces monthly planning spreadsheets with a reliable, well-designed web application. Each user can access only their own accounts, income, commitments, plans, financing, and investments. The owner intends to distribute the project as open source under MIT; repository visibility is a separate operator action. Application registration is available through the web interface.

The owner already understands everyday spending and transfers a monthly budget to a dedicated account. The application must support this workflow without asking the owner to categorize individual purchases.

## Jobs to be done

1. See which income and commitments apply to a selected month.
2. Understand how much remains after planned costs, provisions, and investment allocations.
3. Know how much to allocate to each bank account or space.
4. Reserve a monthly amount for annual bills, independently of their payment dates.
5. Change future income or commitments without rewriting past monthly plans.
6. Follow financing commitments and investment contributions with the appropriate level of detail.
7. Enter financial data manually and retain access to it through compatible JSON export/import.

## Initial release scope

| Capability | Required behavior |
| --- | --- |
| Access | Web registration and login; independent user accounts; revocable server-side sessions |
| Monthly planning | Generate a month, inspect its calculation, apply explicit overrides, and preserve history |
| Accounts and spaces | Configure destinations and view planned allocations and transfer instructions |
| Income | Monthly net salary and professional income with explicit tax/commission components |
| Commitments | Fixed expenses, subscriptions, professional expenses, shared-cost contributions, schedules, and provisions |
| Financing | Monthly payment, dates, payment account, and explicitly reported debt figures |
| Investments | Products, platforms, planned and actual contributions, cryptocurrency purchases and sales |
| Data entry and portability | Manual entry and compatible application JSON export/import, with validated models and atomic import into an empty workspace |
| Experience | Polished responsive UI, clear calculations, accessible interaction, initial Spanish localization |
| Operation | Docker Compose/environment-file delivery and private images; each operator performs their own deployment and infrastructure management |

## Explicit exclusions

- Daily purchase tracking, receipt capture, merchant categorization, and bank transaction reconciliation.
- Bank synchronization, automated money transfers, and brokerage execution.
- Spreadsheet/third-party import. Only the application's compatible financial JSON is imported. The workbook remains optional reference material.
- Automatic backup services and Restic integration in the current scope. JSON financial portability is not a full installation or credential backup.
- Organizations, shared financial workspaces, subscriptions, billing, and commercial administration features. Independent registered users are in scope; sharing data between them is not.
- Automatic market prices, foreign-exchange calculations, and portfolio recommendations in the initial release.
- Tax filing, payroll tax estimation, or automatic loan amortization without separately specified inputs and rules.
- Invented historic transactions inferred from spreadsheet estimates.
- FIFO, investment commissions, cost-basis allocation, and automatic realized-profit calculation. Phase 6 records investment movements and manual valuations; this exclusion does not change professional-income commissions.

## Core experience

The default destination is the monthly overview. It answers three questions in this order:

1. What is my financial plan for this month?
2. What is available after my commitments?
3. Where should I put the money?

Supporting screens expose source details without turning the overview into a spreadsheet. Routine monthly work should not require visiting every configuration page.

## Quality requirements

- Exact, reproducible server-side financial calculations.
- User-scoped authorization on every private record, relationship, and export. Another user's resource must not be readable, editable, or discoverable through identifiers.
- Explicit calculation versions and source provenance for saved monthly plans.
- Transactional plan generation and closing; concurrent edits must not silently overwrite changes.
- Accessible forms, keyboard navigation, clear focus, and WCAG 2.2 AA as the UI target.
- Predictable performance for a personal dataset; pagination and filtering for growing collections.
- Safe configuration handling, authenticated financial endpoints, and useful operational logs.
- Documentation and behavior evolve in the same change.

## Language and presentation

The project is authored in English. Frontend copy is stored in Spanish translation resources, initially `es-ES`. Locale formatting and EUR currency are independent settings. User-entered content is not translated automatically.

The standalone project website under `docs/` is English and always follows the system's light/dark appearance, without a theme selector. It presents implemented capabilities and links to the repository; it does not connect to the financial API. See [website design and behavior](design/project-website.md).

## Success criteria

- The owner can prepare a representative month and understand every amount in the summary.
- Account allocations reconcile with the cash basis defined by the monthly plan.
- A future subscription change cannot alter a closed month.
- Annual payments do not reduce availability twice when already provisioned.
- The owner can operate the application comfortably on desktop and mobile.
- An operator can deploy an identified version through Compose and an environment file; a user can export and import compatible financial JSON without replacing authentication data.

## Evidence boundary

The workbook provides observed formulas and cached figures, not a complete specification. Product rules requiring interpretation remain proposed until confirmed. The [spreadsheet mapping](domain/spreadsheet-mapping.md) and [decision register](decisions.md) identify those boundaries.
