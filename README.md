# Personal Finance

A private, self-hosted application for monthly financial planning, account allocation, commitments, financing, and investments.

The application follows the owner's existing spreadsheet workflow: plan the month, reserve money for commitments, and allocate money to accounts. Everyday purchases are not recorded.

## Project status

**Documentation foundation — phases 0 and 1.** Product requirements, architecture decisions, initial specifications, and UI/UX direction are documented. Application code, package manifests, migrations, CI, and deployment configuration have not been implemented. There are no installation or validation commands yet.

The agreed technical direction is distinguished from proposed business policies throughout the documentation. See the [decision register](docs/decisions.md) before implementing rules that require owner confirmation.

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

Exact compatible versions and any additional libraries must be agreed during scaffolding. No dependencies have been installed.

## Language policy

All project-authored documentation, code, identifiers, comments, filenames, test descriptions, commit messages, and API error codes are English. The initial frontend translation resources contain Spanish copy. Translation keys remain English. User-entered names retain their original language.

## Documentation

### Product and domain

- [Product definition](docs/product.md)
- [Roadmap and delivery gates](docs/roadmap.md)
- [Decision register](docs/decisions.md)
- [Domain glossary](docs/domain/glossary.md)
- [Spreadsheet mapping and reference figures](docs/domain/spreadsheet-mapping.md)

### Engineering

- [Architecture](docs/architecture.md)
- [Architecture decision records](docs/adr/README.md)
- [Testing strategy](docs/testing.md)
- [Agent instructions](AGENTS.md)

### Specifications and design

- [Specification index](docs/specs/README.md)
- [Accounts and allocation](docs/specs/accounts.md)
- [Income](docs/specs/income.md)
- [Commitments and provisions](docs/specs/commitments.md)
- [Monthly planning](docs/specs/monthly-planning.md)
- [UI/UX direction](docs/design/ui-ux.md)
- [Screen flows and structural wireframes](docs/design/screen-flows.md)

Deployment, backup/restore, export, authentication, financing, and investment specifications will be expanded before their corresponding implementation phases. See the roadmap for ownership of these deliverables.

## Repository

[artcc/personal-finance](https://github.com/artcc/personal-finance)

The workbook was used only to document the existing workflow. The owner will enter data manually; data import is outside the product scope. The original workbook is not required for development and can be removed from the project. The documented reference analysis remains available.

## License

[MIT](LICENSE) — Copyright (c) 2026 Arturo Carretero Calvo.
