# Roadmap

Phases describe deliverables, dependencies, and completion evidence. Documentation and tests accompany each feature. A phase is not complete merely because its files exist.

## Current state

- Phase 0: product/domain documentation drafted from the shared requirements and local workbook.
- Phase 1: architecture, initial specs, testing strategy, agent rules, and design direction drafted.
- Owner review and policy decisions remain pending; see the [decision register](decisions.md).
- With owner permission, the 47 local Markdown links were compared against the project file inventory on 2026-09-14; all target files exist. This checks file destinations only, not business-policy correctness, external URLs, or application behavior.
- Phases 2–9: not started.

## Phase 0 — Product and financial model

Deliverables: product definition, glossary, source mapping, reference arithmetic, exclusions, roadmap, and decision register.

Exit gate: owner reviews scope and identifies the intended rules where workbook behavior is ambiguous. No daily transaction-tracking requirements are introduced.

## Phase 1 — Architecture, specifications, and design foundation

Deliverables: architecture, ADRs, first four module specs, testing strategy, UI/UX direction and flows, English README/AGENTS, and MIT license.

Exit gate: foundational documents are reviewed; relevant financial decisions are approved before their implementation. Exact package versions are selected in phase 2 with dependency approval.

## Phase 2 — Monorepo and technical foundation

Build the web/API applications, generated API client, development PostgreSQL, Prisma migration baseline, strict TypeScript configuration, quality tooling, test harnesses, i18n, typed environment configuration, and development Compose setup.

Add GitHub Actions checks for available lint, format, type, test, and build commands. Document only commands that actually exist.

Exit gate: approved targeted checks show the applications start and the API can use PostgreSQL. CI accurately runs available checks.

## Phase 3 — Access and polished application shell

Before implementing the shell, complete the authentication spec and produce a high-fidelity design review covering:

- Desktop and mobile monthly overview.
- Account allocation workflow.
- Commitment editing, including an annual schedule.
- Loading, empty, error, negative-availability, and closed-month states.

Review the visual direction with the owner; document tokens and reusable component variants. Implement single-owner bootstrap, login/logout, session protection, navigation, accessible shell, forms, and localized errors. Capture screenshots of implemented states for comparison with the approved design.

Exit gate: authenticated desktop/mobile shell and sign-in journey work; visual baseline is approved before financial screens are built.

## Phase 4 — Accounts, income, and commitments

Implement accounts/spaces, net salary and professional income, effective-dated recurring commitments, schedules, installments, and provisions. Keep source revisions traceable.

Tests cover exact arithmetic, validity periods, constraints, and persistence. Expand OpenAPI and regenerate the client with each contract change.

Exit gate: representative recurring inputs can be configured; relevant D-01–D-04, D-07, D-09, D-12, and D-13 policies are resolved.

## Phase 5 — Monthly planning and allocation

Implement month generation, saved inputs/results, overrides, allocation instructions, close/reopen lifecycle, and history. Planned investment lines and financing commitments must be supportable before the dedicated phase-6 management screens exist; use explicit classified planning sources rather than fake executed transactions.

Tests cover duplicate generation, concurrent updates, history preservation, exact totals, allocation conservation, and the core end-to-end journey.

Exit gate: the owner can configure inputs, prepare a representative month, inspect availability, allocate money, and close the month. This is the first usable product milestone.

## Phase 6 — Financing and investments

Complete financing and investment specs before coding them. Add financing metadata and reported debt, contribution plans, actual contributions, purchases/sales, fee handling, and manual valuations. Link specialized records to their existing planning sources so obligations appear exactly once.

Resolve cost basis and manually reported opening-value rules before implementing realized results or recording opening positions.

Exit gate: the spreadsheet's financing and investment areas have working counterparts with meaningful tests.

## Phase 7 — Export and manual-data acceptance

Specify and implement a documented machine-readable export. Review the manual-entry journey for the owner's accounts, income, commitments, financing, and investments. Do not implement data import; the original workbook is not required for this phase.

Use manually entered representative scenarios and approved financial fixtures to assess the complete workflow. The documented spreadsheet arithmetic is optional historical context, not a required dataset or an exact-result migration target.

Exit gate: representative data can be entered manually and exported accurately; a representative month reconciles under the approved rules with explainable results.

## Phase 8 — Deployment and operation

Implement multi-stage web/API images, production Compose, private GHCR publication, HTTPS integration, healthchecks, structured logs, explicit migrations, automated backups, and operational procedures.

Create `docs/deployment.md` and `docs/backup-restore.md`. Confirm host configuration and recovery objectives. Document image rollback limitations when database migrations are not backward-compatible.

Exit gate: deploy an identified version and demonstrate an approved backup restoration procedure.

## Phase 9 — Acceptance and first release

Review spec acceptance criteria, desktop/mobile journeys, accessibility, locale behavior, owner data, operational documentation, and outstanding defects. Run the agreed release checks and publish release notes when authorized.

Exit gate: owner acceptance, successful agreed checks, reviewed deployment/recovery instructions, and a recorded backlog for later improvements.

## Working agreement

- Read related documents and code before changing them.
- Resolve decisions at the latest responsible phase, before dependent behavior is implemented.
- Ask before installing/updating dependencies or running local validation commands.
- Prefer the smallest useful validation scope; do not automatically run full suites.
- Commit, push, and publish only when explicitly requested.
