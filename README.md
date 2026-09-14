# Personal Finance

A self-hosted application for monthly financial planning, account allocation, commitments, financing, and investments, with web registration and independent private user accounts.

The application follows the owner's existing spreadsheet workflow: plan the month, reserve money for commitments, and allocate money to accounts. Everyday purchases are not recorded.

## Project status

**Phase 6 — financing and simplified investments implemented; CI verification pending.** The owner reported phase-5 CI green. Financing now records payment links and explicit debt; investments record contributions, purchases/sales, quantities, and manual valuations. FIFO, investment commissions, cost basis, and automatic realized-profit calculation are excluded by owner decision.

The agreed technical direction is distinguished from proposed business policies throughout the documentation. See the [decision register](specs/decisions.md) before implementing rules that require owner confirmation.

### Design review

Open [the phase-3 visual proposal](specs/design/phase-3-preview.html) directly in a browser: it needs no Node process or compilation. It includes responsive monthly overview, allocation, annual commitment, and alternate states using clearly labeled synthetic data. Design labels are English documentation; the implemented application uses Spanish i18n resources. The owner has approved this visual direction for financial screen implementation.

The implemented web routes include access, monthly planning, accounts, income, commitments, `/financing`, and `/investments`, with detail/history screens for the latter two. There are no default credentials. Registration creates independent accounts; email verification and email delivery are not yet implemented. Server-side password recovery is documented in the development guide. Export and manual-data acceptance are the next phase.

## Product goals

- Prepare a monthly plan and understand the available amount.
- Manage income, recurring commitments, annual provisions, financing, and investment plans.
- Allocate money between accounts and spaces without double-counting spending.
- Preserve monthly history when future plans change.
- Provide a polished, accessible, responsive interface.
- Remain straightforward to develop, test, deploy, and restore.

## Technical direction

| Area | Choice |
| --- | --- |
| Architecture | Modular monolith in a pnpm monorepo; separate web and API applications |
| Language | Strict TypeScript |
| Web | React, Vite, React Router, TanStack Query |
| Forms and UI | React Hook Form, Zod, Tailwind CSS, shadcn/ui |
| API | NestJS with Fastify, REST, OpenAPI, generated API client |
| Persistence | PostgreSQL, Prisma, versioned SQL migrations |
| Internationalization | i18next, react-i18next, Intl; initial locale es-ES |
| Quality | ESLint, Prettier, type checking, Vitest, HTTP integration tests, Playwright |
| Delivery | GitHub Actions, private GHCR images, Docker Compose, Portainer |

Dependencies are pinned to approved stable versions and recorded in `pnpm-lock.yaml`. The policy is the newest stable compatible release, excluding alpha, beta, and release candidates. CI/images use Node 26.8.2 and pnpm 12.4.1. TypeScript remains at 5.9.3 because the selected OpenAPI generator and ESLint parser do not yet jointly support TypeScript 7; see ADR 002.

## Local workflow

The owner's workflow keeps compilation and tests in CI. Use the existing Node installation; the helper below downloads only pnpm into the project cache and does not install or switch Node globally.

```sh
node scripts/pnpm-local.mjs install --ignore-scripts
node scripts/pnpm-local.mjs lint
```

Installation scripts are deliberately disabled for this local lint-only workflow. Generated Prisma/API-client files and compiled applications will not exist after this installation. They are generated during CI/container builds. Formatting, if authorized, is available through `node scripts/pnpm-local.mjs format`.

See [development and CI commands](specs/development.md) for the full build/test graph and [release image delivery](specs/release-images.md) for Docker/Portainer consumption.

## Release images

Publishing a stable GitHub release with a tag such as `v0.1.0` triggers `.github/workflows/release-images.yml`. After the exact release commit passes CI, the workflow publishes:

- `ghcr.io/artcc/personal-finance-api:v0.1.0`
- `ghcr.io/artcc/personal-finance-web:v0.1.0`

Both images support `linux/amd64` and `linux/arm64`. Publication does not deploy the server. Wait for the entire publication workflow to succeed before using the release in Compose/Portainer. No release or images have been published as part of scaffolding.

## Language policy

All project-authored documentation, code, identifiers, comments, filenames, test descriptions, commit messages, and API error codes are English. The initial frontend translation resources contain Spanish copy. Translation keys remain English. User-entered names retain their original language.

## Documentation

Engineering documentation lives in `specs/`. The `docs/` path is reserved for the future static project website and its GitHub Pages deployment.

### Product and domain

- [Product definition](specs/product.md)
- [Roadmap and delivery gates](specs/roadmap.md)
- [Decision register](specs/decisions.md)
- [Domain glossary](specs/domain/glossary.md)
- [Spreadsheet mapping and reference figures](specs/domain/spreadsheet-mapping.md)

### Engineering

- [Architecture](specs/architecture.md)
- [Architecture decision records](specs/adr/README.md)
- [Testing strategy](specs/testing.md)
- [Development and CI commands](specs/development.md)
- [Release image delivery](specs/release-images.md)
- [Agent instructions](AGENTS.md)

### Specifications and design

- [Specification index](specs/specs/README.md)
- [Registration, authentication, and sessions](specs/specs/authentication.md)
- [Accounts and allocation](specs/specs/accounts.md)
- [Income](specs/specs/income.md)
- [Commitments and provisions](specs/specs/commitments.md)
- [Monthly planning](specs/specs/monthly-planning.md)
- [Financing](specs/specs/financing.md)
- [Investment movements](specs/specs/investments.md)
- [UI/UX direction](specs/design/ui-ux.md)
- [Screen flows and structural wireframes](specs/design/screen-flows.md)

Host-specific deployment, backup/restore, export, financing, and investment specifications will be expanded before their corresponding implementation phases. Authentication is specified in phase 3. Basic image delivery and Compose consumption are documented; the full operational release gate remains in phase 8.

## Repository

[artcc/personal-finance](https://github.com/artcc/personal-finance)

The workbook was used only to document the existing workflow. The owner will enter data manually; data import is outside the product scope. The original workbook is not required for development and can be removed from the project. The documented reference analysis remains available.

## License

[MIT](LICENSE) — Copyright (c) 2026 Arturo Carretero Calvo.
