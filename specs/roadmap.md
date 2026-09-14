# Roadmap

Phases describe deliverables, dependencies, and completion evidence. Documentation and tests accompany each feature. A phase is not complete merely because its files exist.

## Current state

- Phase 0: product/domain documentation drafted from the shared requirements and local workbook.
- Phase 1: architecture, initial specs, testing strategy, agent rules, and design direction drafted.
- Owner review and policy decisions remain pending; see the [decision register](decisions.md).
- With owner permission, the 47 local Markdown links were compared against the project file inventory on 2026-09-14; all target files exist. This checks file destinations only, not business-policy correctness, external URLs, or application behavior.
- Phase 2: implementation complete; the owner reported GitHub Actions green. First release-image publication still needs its own evidence.
- Phases 3–4: access and financial configuration implemented; the owner reported CI green after the logout corrections. The visual direction and phase-4 financial policies are approved.
- Phase 5: monthly planning implemented; the owner reported CI green.
- Phase 6: implemented; the owner reported CI green. FIFO, investment commissions, and automatic realized profit remain excluded.
- Current phase 7 scope: JSON export/import only. Implementation and regression tests are present, with current runtime verification pending in CI.
- Phase 8: operator responsibility; no server configuration or backup tooling added.
- Phase 9 website subset: subsequently requested by the owner and implemented under `docs/`. Authorized, scoped website format/lint checks passed; browser review remains pending. Publication, repository visibility, and release acceptance have not been performed.

## Phase 0 — Product and financial model

Deliverables: product definition, glossary, source mapping, reference arithmetic, exclusions, roadmap, and decision register.

Exit gate: owner reviews scope and identifies the intended rules where workbook behavior is ambiguous. No daily transaction-tracking requirements are introduced.

## Phase 1 — Architecture, specifications, and design foundation

Deliverables: architecture, ADRs, first four module specs, testing strategy, UI/UX direction and flows, English README/AGENTS, and MIT license.

Exit gate: foundational documents are reviewed; relevant financial decisions are approved before their implementation. Exact package versions are selected in phase 2 with dependency approval.

## Phase 2 — Monorepo and technical foundation

Build the web/API applications, generated API client, development PostgreSQL, Prisma migration baseline, strict TypeScript configuration, quality tooling, test harnesses, i18n, typed environment configuration, and development Compose setup.

Add GitHub Actions checks for lint, code/configuration format, types, contract generation, tests, application builds, and container startup. Include multi-stage API/web Docker targets and a stable-release workflow (`release: published`) that runs the checks against the exact release commit and then publishes private versioned GHCR images for `linux/amd64` and `linux/arm64`. Provide initial Compose consumption instructions. Publication does not automatically deploy the host.

Implemented files include `.github/workflows/ci.yml`, `.github/workflows/release-images.yml`, `infra/docker/Dockerfile`, `compose.dev.yaml`, and `compose.yaml`. See the development and release-image guides for actual commands. Do not claim their CI/runtime checks have passed without a successful run.

Exit gate: CI demonstrates application builds, PostgreSQL connectivity/migrations, the foundation tests, and container startup; release publication is verified with an explicitly authorized GitHub release. Local lint alone does not satisfy the phase's runtime acceptance gate.

## Phase 3 — Access and polished application shell

Before implementing the shell, complete the authentication spec and produce a high-fidelity design review covering:

- Desktop and mobile monthly overview.
- Account allocation workflow.
- Commitment editing, including an annual schedule.
- Loading, empty, error, negative-availability, and closed-month states.

Review the visual direction with the owner; document tokens and reusable component variants. Implement web registration/login for independent users, protected sessions, per-user session management, server-side targeted password recovery, navigation, accessible shell, forms, and localized errors. Capture screenshots of implemented states and the synthetic financial design proposal. The owner explicitly replaced single-owner bootstrap with web registration during this phase.

Exit gate: CI verifies registration/login, lifetime/revocation, Origin/CSRF, user isolation, and the desktop/mobile shell; the owner approves the financial visual baseline before those screens are implemented. See `specs/design/phase-3-preview.html` and the browser-evidence artifact.

## Phase 4 — Accounts, income, and commitments

Implement accounts/spaces, net salary and professional income, effective-dated recurring commitments, schedules, installments, and provisions. Keep source revisions traceable.

Tests cover exact arithmetic, validity periods, constraints, and persistence. Expand OpenAPI and regenerate the client with each contract change.

Exit gate: representative recurring inputs can be configured; relevant D-01–D-04, D-07, D-09, D-12, and D-13 policies are resolved.

## Phase 5 — Monthly planning and allocation

Implement month generation, saved inputs/results, overrides, allocation instructions, close/reopen lifecycle, and history. Planned investment lines and financing commitments must be supportable before the dedicated phase-6 management screens exist; use explicit classified planning sources rather than fake executed transactions.

Tests cover duplicate generation, concurrent updates, history preservation, exact totals, allocation conservation, and the core end-to-end journey.

The implementation keeps the regular flow to prepare → review → allocate → close. Advanced adjustments and refresh/conflict decisions are contextual dialogs. It adds no runtime services or packages. Local work remains limited to owner-approved format/lint checks; runtime acceptance is a CI gate.

Exit gate: the owner can configure inputs, prepare a representative month, inspect availability, allocate money, and close the month. This is the first usable product milestone.

## Phase 6 — Financing and investments

Add financing metadata and reported debt, optional contribution plans, actual contributions, purchases/sales, and manual valuations. Link specialized records to existing planning sources or create that single source atomically. Keep the interface direct and worksheet-like; no investment commission or cost-basis workflow is included.

The owner resolved D-08 by choosing movement recording without automatic realized-profit calculation. Explicit opening records preserve known units/capital without inventing historical purchases; unknown opening capital remains identified as partial information.

Exit gate: the spreadsheet's financing and investment areas have working counterparts with meaningful tests.

## Phase 7 — Compatible JSON portability

Provide private export and import of the application's versioned financial JSON. Validate models, monetary values, snapshots, and references; remap identities and import atomically into an empty destination. Do not add CSV/Excel import, merging, overwriting, Restic, or backup services. The original workbook is not required.

Use manually entered representative scenarios and approved financial fixtures to assess the complete workflow. The documented spreadsheet arithmetic is optional historical context, not a required dataset or an exact-result migration target.

Exit gate: CI demonstrates a private, exact export/import round trip, including historical plans, user isolation, rejection of incompatible files, and rollback of partial writes.

## Phase 8 — Deployment and operation

Current owner direction: each operator deploys with Docker Compose and their own environment file. Do not access their server or add backup tooling. The original operational outline below is retained as historical/future context, not an active implementation request.

Use the images, release workflow, and initial Compose files from phase 2. Complete host-specific HTTPS/trusted-proxy integration, operational health/logging policy, migration/update procedures, automated backups, and recovery instructions.

Create `specs/deployment.md` and `specs/backup-restore.md`. Confirm host configuration and recovery objectives. Document image rollback limitations when database migrations are not backward-compatible.

Exit gate: deploy an identified version and demonstrate an approved backup restoration procedure.

## Phase 9 — Acceptance and first release

The owner subsequently requested the English static website, superseding the earlier “JSON only for now” limit for this deliverable. The site is implemented under `docs/`; verification and publication remain pending. The broader release gate below is not complete.

Review spec acceptance criteria, desktop/mobile journeys, accessibility, locale behavior, owner data, operational documentation, and outstanding defects. Run the agreed release checks and publish release notes when authorized.

The project's static website uses separate HTML, CSS, JavaScript, and local assets under `docs/`. See [website design and behavior](design/project-website.md). Configure GitHub Pages delivery when authorized. Engineering specifications, decisions, and design references remain under `specs/`; publish only the intended website content, not the engineering/reference directory.

Exit gate: owner acceptance, successful agreed checks, reviewed deployment/recovery instructions, and a recorded backlog for later improvements.

## Working agreement

- Read related documents and code before changing them.
- Resolve decisions at the latest responsible phase, before dependent behavior is implemented.
- Ask before installing/updating dependencies or running local validation commands.
- Prefer the smallest useful validation scope; do not automatically run full suites.
- Commit, push, and publish only when explicitly requested.
