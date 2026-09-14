# Testing Strategy

Status: phase-2 foundation checks implemented; local lint passed, runtime/CI checks not yet executed. The broader financial test strategy remains planned for subsequent features.

## Principles

- Test meaningful financial behavior and failure modes, not framework implementation details.
- Financial domain tests should run without NestJS, Prisma, a browser, or a database.
- Persistence invariants need real PostgreSQL tests rather than ORM mocks or SQLite substitutes.
- Keep a small E2E suite for owner journeys; do not duplicate every unit case in the browser.
- Examples affected by proposed policies remain draft acceptance scenarios until those policies are approved.
- For local work, request permission before any tests, builds, linters, type checks, formatters, link checks, or other validators.

## Layers

| Layer | Planned tools | High-value evidence |
| --- | --- | --- |
| Domain | Vitest | Exact arithmetic, date boundaries, provision conservation, income components, allocation invariants |
| Application | Vitest with narrow fakes | Use-case decisions, explicit clock, refresh/override conflicts, authorization context |
| Persistence/API integration | Vitest + disposable PostgreSQL + Fastify HTTP injection | Transactions, constraints, session behavior, request validation, concurrent generation/closing |
| Web behavior | Vitest-compatible component tests; additional libraries require approval | Localized form behavior, error-code mapping, accessibility interactions, exact money input |
| E2E | Playwright | Login, prepare month, inspect explanation, allocate money, close month |
| Contract | Deterministic OpenAPI/client generation check | Generated client matches API schema |
| Visual/accessibility | Browser review and targeted automated checks when tooling is approved | Approved layout, keyboard behavior, narrow viewports, text expansion, key UI states |

## Financial acceptance matrix

| Requirement | Cases |
| --- | --- |
| Availability | Positive, zero, negative; each charge deducted once |
| Annual provisions | Divisible/non-divisible cents, full-cycle sum, mid-cycle activation, revised annual amount |
| Effective dates | Before start, start boundary, end boundary, after end, February/leap year |
| Income | Salary, direct client, platform commission, collected VAT, withholding, component rounding |
| Allocation | Parent/space exclusivity, linked charges, residual destination, under-allocation, over-allocation |
| History | Future edit after close; archive source after close; reopen preserves previous revision |
| Generation | Repeated request, simultaneous requests, failed transaction, retry without duplicate lines |
| Overrides | Survives valid refresh; source removal produces a conflict; stale version rejected |
| Investments | Unsold position, partial sale, fees, future plan, planned versus actual contributions |
| Manual entry and export | Explicit opening values and as-of dates, form persistence, complete exports, exact serialized amounts |

## Reference fixtures

Use the [spreadsheet mapping](domain/spreadsheet-mapping.md) as evidence, not as executable truth. Maintain separate fixture categories:

1. **Export reference arithmetic:** records the source's displayed EUR 3,160.00 income, EUR 2,036.08 charges, and EUR 1,123.92 availability without claiming date-correct behavior.
2. **Approved application rules:** explicit month, active revisions, cent policy, dates, and expected totals. Differences from export arithmetic must be documented.

Use small synthetic values for most tests. Do not require the owner's complete workbook to run CI. Fix time with an injected clock and choose deterministic schedules; never make assertions depend on the wall clock.

## PostgreSQL test isolation

Use a dedicated disposable test database, apply real migrations, and isolate fixtures per test group. Never point integration tests at development or production data. Use multiple real connections for concurrency tests; a single rolled-back transaction cannot demonstrate uniqueness races. Test rollback behavior explicitly.

## First useful E2E journeys

1. Bootstrap owner through the supported setup path; log in and log out.
2. Configure salary, accounts, monthly commitment, and annual obligation.
3. Generate a month, expand its calculation, and view exact totals.
4. Assign the everyday spending amount and reconcile all account destinations.
5. Close the month, change a future source amount, and verify preserved history.

Add financing and export journeys when those modules are implemented. Keep financial seed data deterministic and limited to the scenario. No import tests or workbook-dependent fixtures are required.

## UI review evidence

Review desktop and mobile screenshots for overview, allocation, and commitment editing. Include loading, empty, error, shortfall, and closed states. Verify keyboard order, visible focus, labels, focus restoration after dialogs, contrast, and zoom/reflow. Screenshot comparisons do not replace semantic assertions or accessibility review.

## Implemented foundation checks and CI gates

The current workflow runs code/configuration formatting, lint, builds, type checking, deterministic API-client generation, migrations, environment unit tests, health HTTP tests, real PostgreSQL singleton/rollback tests, and a small desktop/mobile browser set. Container jobs build and check startup without publishing on ordinary CI runs. The release workflow invokes these checks before publication. See `package.json` for script names and [the development guide](development.md) for ordering.

Foundation tests cover only behavior that exists: environment rejection, live/ready separation, safe infrastructure errors, singleton-owner constraints, transaction rollback, localized API connection, mobile overflow, and retry feedback. They do not imply financial calculations or authentication have been implemented. The database suite requires an explicitly configured disposable database ending in `_test` and will not silently skip when configuration is missing.

Markdown is reviewed separately and excluded from the source/configuration formatting gate to avoid unrelated document rewrites. Pin supported tool versions and provide required test services. Coverage reports are diagnostic; no arbitrary coverage percentage substitutes for testing financial invariants in later phases.

The owner requested no local compilation or tests and no replacement Node installation. Dependencies were installed with scripts disabled; only authorized lint/format operations run locally. A successful lint result does not establish build, migration, browser, container, or CI success.

## Documentation-only validation proposal

For phases 0 and 1, the smallest relevant executable check is a read-only local Markdown link/anchor check limited to the newly authored documentation and an English-language consistency review. Ask the owner before running it. No dependency installation, formatting rewrite, application build, or complete test suite is required for this documentation change.
