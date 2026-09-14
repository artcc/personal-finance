# Decision Register

This register separates confirmed requirements from proposals requiring owner approval. An ADR marked **accepted direction** records the accepted stack or architecture direction; it does not imply that every business policy has been accepted.

## Confirmed requirements

- Self-hosted application with web registration/login and multiple independent users. The owner explicitly replaced the single-owner restriction during phase 3; every user's financial data remains isolated.
- Monthly planning rather than everyday purchase tracking.
- Manual entry plus compatible application JSON export/import. Spreadsheet import remains excluded. Import validates the models and references and does not overwrite an existing financial workspace. The workbook remains optional historical reference.
- Modular monolith, pnpm monorepo, and the TypeScript/React/NestJS/PostgreSQL stack described in the architecture.
- Tests, lint, type checks, clear specifications, agent instructions, README, and MIT licensing.
- Docker, Docker Compose, and Portainer deployment direction.
- Phase 2 includes Docker image publication to private GHCR packages on stable GitHub release publication. Both API and web images must pass the release checks before the version is consumed in Docker/Portainer.
- Use the newest stable mutually compatible dependencies; no alpha, beta, or release candidates. Keep the current macOS Node installation and run only approved lint/format checks locally; builds and tests run in CI.
- English project content; Spanish frontend translation resources; future languages supported.
- Polished UI/UX is a product requirement, not a final cosmetic task.
- MIT copyright holder: Arturo Carretero Calvo.

## Business policies to confirm

Phase-4 resolution (2026-09-14): the owner explicitly approved D-01, D-02, D-03, D-04, D-07, D-09, D-12, and D-13 in the phase-4 clarification. Their recorded defaults below are approved implementation policies.

Phase-5 resolution (2026-09-14): the owner explicitly selected the recommended options for D-05, D-06, and D-11:

- **D-05:** reopening requires a reason and creates a new editable revision. The original closed revision remains available; corrections never overwrite it.
- **D-06:** everyday spending is an allocation, not an additional planning charge. With EUR 2,000 income and EUR 1,100 commitments, planned availability remains EUR 900; allocating EUR 600 to everyday spending leaves EUR 300 of that availability still to assign. The UI must label these amounts distinctly.
- **D-11:** an underfunded plan may close only after explicit shortfall acknowledgement and exact reconciliation of allocations to expected cash. With EUR 1,000 net salary and EUR 1,200 planning charges, the EUR 200 shortfall remains visible even if the EUR 1,000 cash allocation reconciles. Closing neither invents funding nor confirms payment execution.

These decisions authorize the corresponding phase-5 policies, not a claim that they are implemented or validated.

Phase-6 resolution (2026-09-14): the owner explicitly excluded FIFO and investment commissions, then selected recording movements without automatic realized-profit calculation. D-08 is resolved by removing cost-basis accounting from this release, not by silently substituting weighted average. Existing professional-income commission rules remain unchanged.

| ID | Decision | Recorded policy | Applies to |
| --- | --- | --- | --- |
| D-01 | Monthly provision rounding | Allocate each obligation's annual cents across 12 months; floor share plus one cent for the first remainder months in a January–December cycle | Provision engine and acceptance fixtures |
| D-02 | Joining a provision cycle mid-year | Begin future monthly provisions without automatically catching up; require an explicit opening reserve or additional contribution if reserve sufficiency is shown | Provision UI |
| D-03 | Effective dates within a month | Planning uses inclusive `startsOn`/`endsOn` overlap with the month; full monthly charge on overlap, no daily proration; due schedules remain separate | Income and commitment scheduling |
| D-04 | Professional income and taxes | Separate expected cash receipts, collected-VAT reserve, and spendable income; withholdings reduce receipt and are not reserved again; commission is deducted once from receipt | Professional income calculations |
| D-05 | Closing and reopening | Explicit close; reopening requires a reason and creates a new editable revision while preserving the closed revision | Monthly lifecycle |
| D-06 | Everyday spending allocation | Allocate a user-entered part of planned availability to the spending account, without another expense; keep the remaining amount visible | Allocation editor |
| D-07 | Annual payment splits | Require the owner to enter explicit installment amounts; installment totals must equal the annual obligation | Due-payment schedules |
| D-08 | Investment movements | Record contributions, purchases, sales, quantities, and manual valuations; no FIFO, investment commissions, cost allocation, or automatic realized profit | Phase-6 investments |
| D-09 | Reserve tracking depth | Start with planning provisions and due-payment visibility; no inferred bank reserve balance or automatic month-to-month carry-forward | Final provision spec |
| D-11 | Underfunded plans | Allow negative availability and show a persistent shortfall; permit closing with explicit acknowledgement; require allocations to reconcile to expected receipts | Monthly close criteria |
| D-12 | Tax and commission precision | Round each computed component half away from zero to cents; commission based on pre-tax base; support this deducted-commission scenario first | Professional income API |
| D-13 | Missing calendar due day | Clamp a day-31 schedule and February 29 annual schedules to the last valid day of the relevant month; do not shift weekends/holidays | Payment schedule generation |

Specs reference these IDs. Implementers may use the explicitly approved phase-4/5 policies and the simplified phase-6 scope. Any additional financial policy still requires confirmation.

## Withdrawn decisions

- **D-10 — Spreadsheet opening values:** withdrawn on 2026-09-14 after the owner excluded spreadsheet migration. Do not build spreadsheet import or mapping workflows. Manually reported financing/investment opening amounts still require explicit values and as-of dates; do not infer execution history. The subsequently approved application JSON import is a separate feature.

Scope update (2026-09-14): D-10's spreadsheet-import proposal remains withdrawn, but the owner subsequently requested application JSON export/import when models are compatible. That replaces the broader prohibition on all import. The owner also explicitly excluded backup tooling and server deployment work from the current task; no Restic dependency was approved or added. At that point, the implementation request was limited to JSON portability.

Subsequent website request (2026-09-14): the owner requested an English static project website in `docs/`, with separate HTML/CSS/JavaScript, a hero, top navigation, repository link, official black/white GitHub marks, and Light/Automatic themes. The project is intended to be open source under its existing MIT license. Creating the site does not authorize changing repository/package visibility or publishing GitHub Pages or a release. See [website design and behavior](design/project-website.md).

Website theme update (2026-09-14): the owner removed the theme selector and chose automatic system appearance only. This supersedes the manual Light option; the website no longer reads or saves a theme preference.

## Engineering and design follow-ups

| ID | Item | Current direction | Needed before |
| --- | --- | --- | --- |
| E-03 | Host infrastructure | Chosen and operated independently by each person through Docker Compose and their environment file; no agent access/configuration | Operator responsibility |
| E-04 | Backup infrastructure | Outside the current repository task; no backup service or dependency is added | Operator responsibility |

## How to record a resolution

Record the owner-approved choice, date, and affected documents in this file. Update the relevant ADR/spec and examples together. Preserve superseded decisions in ADR history rather than deleting their rationale. Never turn a proposal into an accepted decision solely because code has been written.

## Resolved engineering choices

- **E-02 — Phase-6 quantity arithmetic:** reuse the existing exact decimal parser and bigint arithmetic with eight fractional places for units. Store quantities as PostgreSQL NUMERIC; no extra dependency or cost-basis engine is required.

- **E-06 — Visual direction, 2026-09-14:** the owner accepted the current financial preview, including its charts and aligned header/content widths, and authorized phase 4. Keep the light theme, deep teal accent, financial hierarchy, and responsive layouts. This approves the design direction; it does not certify accessibility measurements or the still-pending CI run.

- **E-05 — Access model, 2026-09-14:** the owner requested web registration/login and confirmed multiple independent users. ADR 009 supersedes the single-owner proposal. Phase 3 uses server-side sessions, Node's stable scrypt implementation, protected cookies, same-origin/CSRF checks, and bounded access attempts. Defaults and the server-side password recovery procedure are specified in the authentication spec. Email is a login identifier; outbound email delivery/verification is not implemented in this phase.

- **E-01 — Runtime and packages, 2026-09-14:** the owner authorized project-local dependencies and requested newest stable compatible versions. Node 26.8.2 is the existing local runtime and the CI/container runtime; pnpm 12.4.1 is pinned. PostgreSQL 18.6 and Prisma 7.10.0 are selected, excluding the PostgreSQL 19 beta and Prisma 8 release candidate. TypeScript 5.9.3 is the compatibility intersection for `openapi-typescript` 7.13.0 (`^5.x`) and `typescript-eslint` 8.70.0 (`<6.1.0`); TypeScript 7.0.2 is deferred until those tools support it together. Additional direct versions are pinned in manifests and the lockfile. No alternate Node version is installed locally.
