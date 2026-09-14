# Agent Instructions

## Product boundaries

Build a self-hosted monthly financial planner with web registration and independent user accounts. Read [the product definition](docs/product.md) and [architecture](docs/architecture.md) before implementing features. Each user's financial data is private to that user. Everyday purchase tracking, data import, and bank synchronization are outside the initial scope. Users enter data manually; export remains in scope.

## Language

- Author code, identifiers, comments, filenames, documentation, test names, API codes, and commit messages in English.
- Put initial frontend-facing copy in Spanish i18n resources with English semantic keys. Use `es-ES` initially.
- Do not hardcode visible copy, accessibility labels, validation messages, or toast text in components.
- Preserve user-entered names and original reference labels in their original language.
- Project language rules govern repository content; follow the owner's preferred language for conversation.

## Before editing

1. Read directly related source files, specifications, ADRs, and existing instructions.
2. Inspect existing work and preserve changes you did not create.
3. Check [the decision register](docs/decisions.md). Do not implement a proposed financial policy as though it were approved.
4. When fixing a bug, explain its root cause before making the fix.
5. Keep changes minimal, coherent, and within the requested phase or feature.

## Architecture

- Use the agreed pnpm monorepo, with `apps/api`, `apps/web`, and `packages/api-client` once scaffolded.
- Keep financial domain rules in the API domain layer, independent of NestJS, Prisma, HTTP, and UI frameworks.
- Put use-case orchestration and transaction requirements in application services; implement external interfaces in infrastructure.
- Keep HTTP controllers thin. Validate at boundaries and enforce domain invariants inside the domain.
- Use narrow module interfaces. Do not import another module's persistence adapters or Prisma models into domain code.
- Derive the current user from the authenticated server-side session. Scope financial reads, writes, exports, and relationship checks to that user; never trust a caller-supplied user ID to authorize access. Do not expose whether another user's resource exists.
- Introduce ports where a real boundary needs isolation; avoid generic repositories or abstractions that add no domain value.
- Generate the frontend API client from OpenAPI. Do not maintain duplicate handwritten response types or edit generated code manually.
- Use TanStack Query for remote state and React Hook Form/Zod for form validation. Final calculations come from the API.
- Do not add microservices, queues, caches, or packages without a demonstrated requirement and approval for dependencies.

## Financial integrity

- Use exact cents for EUR money and exact decimal arithmetic for quantities, rates, and cost calculations.
- Serialize money and decimals according to ADR 003; never rely on binary floating-point arithmetic for financial results.
- Keep calendar dates, planning months, and UTC audit timestamps distinct.
- Separate expected cash, spendable income, provisions, payments, and allocations.
- Transfers and allocation instructions must not create duplicate planning charges.
- Do not infer actual contributions, sales, balances, or historical transactions from a plan or elapsed time.
- Preserve closed snapshots and source provenance. Changes require explicit revisions and audit events.
- Keep plan generation idempotent and state transitions transactional; reject stale concurrent edits.
- The workbook is optional historical reference, not a development dependency. Do not alter or delete owner files without authorization, or copy apparent spreadsheet formula defects into business rules.

## UI/UX

- Follow [the UI/UX direction](docs/design/ui-ux.md) and [screen flows](docs/design/screen-flows.md).
- Treat design quality as acceptance criteria: spacing, typography, visual hierarchy, mobile behavior, and states must be implemented deliberately.
- Use shared semantic tokens and reusable component variants rather than one-off styling.
- Include empty, loading, error, read-only, and negative-availability states where relevant.
- Preserve keyboard access, visible focus, accessible labels, and textual meaning independent of color.
- Format values using locale-aware presentation. Do not expose backend errors or raw exception messages as user copy.

## Dependencies and validation

- Ask before adding or updating dependencies, even when the technology family was previously agreed.
- Ask before running tests, builds, linters, type checks, formatters, link checkers, or other validation commands.
- Propose the smallest relevant check first and describe what it establishes.
- Do not run full test suites automatically. Broaden approved checks only when new failures or changes justify it and permission covers the scope.
- Write meaningful tests for financial rules, persistence invariants, and important journeys. Avoid tests that merely mirror implementation.
- Document commands only after they exist. See `package.json` and [the development guide](docs/development.md) for the implemented scripts.
- The owner currently runs only approved lint/format checks locally using the existing Node installation. Do not install another Node version or run local builds, type checks, code generation, tests, or containers without new authorization. Builds and tests are configured in CI.
- Use `node scripts/pnpm-local.mjs` for local pnpm operations so caches/state remain inside the project. Local dependency installation uses `install --ignore-scripts`.
- CI will run the agreed checks automatically once implemented; do not claim CI success without actual evidence.

## Files, Git, and scope

- Work only within this project unless explicitly authorized otherwise.
- Do not initialize unrelated projects, overwrite owner files, discard changes, or run destructive Git commands.
- Ask before destructive or difficult-to-reverse operations.
- Do not commit, amend, push, create pull requests, or publish releases without an explicit request.
- Before any authorized commit, inspect status, diff, and recent history; stage only intended files and exclude secrets and unintended source data.
- Do not fix unrelated pre-existing problems or perform opportunistic refactors.
- Do not delegate to subagents unless explicitly requested.

## Completion evidence

Update affected specs and ADRs alongside behavior changes. Report what changed, what was actually checked, what remains unverified, and any owner decisions blocking subsequent work. Do not describe a drafted document, unrun test, or proposed policy as validated or approved.
