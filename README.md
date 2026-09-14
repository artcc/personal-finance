<p align="center">
  <img src="docs/assets/favicon.svg" alt="Personal Finance" width="80" height="80" />
</p>

<h1 align="center">Personal Finance</h1>

<p align="center">
  <strong>Your month. A little clearer.</strong><br />
  An open-source, self-hosted monthly financial planner.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0f766e?style=flat-square" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="Strict TypeScript" />
  <img src="https://img.shields.io/badge/Deploy-Docker_Compose-2496ed?style=flat-square&amp;logo=docker&amp;logoColor=white" alt="Deploy with Docker Compose" />
  <img src="https://img.shields.io/badge/Interface-Spanish-0f766e?style=flat-square" alt="Interface: Spanish" />
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#getting-started"><strong>Getting started</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#documentation"><strong>Documentation</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/artcc/personal-finance/issues"><strong>Feedback</strong></a>
</p>

Personal Finance brings your income, commitments, accounts, financing, and investments into one monthly view. Understand what is available, decide where it should go, and keep a clear record of your plans over time.

Run it on your own server with Docker Compose. Each registered user has an independent financial workspace, and compatible JSON export/import lets you move your financial records between installations.

## Highlights

| | |
| --- | --- |
| **The monthly picture** | Plan income, recurring costs, and annual provisions together. |
| **A purpose for every amount** | Allocate expected cash across accounts and spaces, including your everyday spending budget. |
| **History that stays intact** | Preserve closed months when future income or commitments change. |
| **Your own workspace** | Separate user accounts with private financial records and session-based access. |
| **Self-hosted and open source** | Deploy in your own environment and explore the code under the MIT license. |

## Features

### Monthly planning

- Prepare a monthly plan from your income and commitments.
- See expected cash, planned availability, and allocation amounts separately.
- Review calculations, make explicit adjustments, and identify shortfalls.
- Close a month to preserve its snapshot; reopen it with a reason and a new revision.
- Browse saved monthly history and charts.

### Accounts, income, and commitments

- Organize accounts and spaces as destinations for planned allocations.
- Set up recurring or one-month income, including net salary and professional income.
- Record professional-income tax and commission components.
- Manage fixed costs, subscriptions, installment schedules, and annual provisions.
- Change future inputs while preserving the source details used by earlier plans.

### Financing and investments

- Keep financing details, payment schedules, and reported debt figures together.
- Link financing payments and investment contribution plans to monthly commitments.
- Record actual investment contributions, purchases, sales, and unit movements.
- Enter manual valuations and explicitly reported opening positions.

### Access and data portability

- Register and sign in through the web interface.
- Keep each user's accounts, plans, and financial records private to that user.
- Manage active sessions.
- Export financial records as application JSON.
- Preview and import a compatible file into an empty workspace, with relationship validation and atomic insertion.
- Use a responsive Spanish interface with locale-aware EUR formatting.

Personal Finance focuses on monthly planning. Financial records are entered manually or imported from a compatible application export; it does not synchronize bank accounts or track individual everyday purchases. Investment movements and valuations are recorded explicitly, without automatic market prices or realized-profit calculations.

## A simple monthly routine

1. **Set up your workspace.** Add accounts, income, recurring commitments, and annual obligations.
2. **Prepare the month.** Review what you expect to receive and what you need to provide for.
3. **Allocate your money.** Give each amount a destination in your accounts and spaces.
4. **Close and keep the record.** Save the month's plan and return to its history whenever you need it.

Allocations are planning instructions. They do not execute bank transfers or mark payments and investments as completed.

## Getting started

### Requirements

- A server with Docker Engine and Docker Compose.
- A release image tag for both the API and web containers.
- An HTTPS origin and a reverse proxy forwarding to the web container.
- Pull access to the project's GitHub Container Registry images.

### Deploy with Docker Compose

1. **Get the project and prepare your environment file:**

   ```sh
   git clone https://github.com/artcc/personal-finance.git
   cd personal-finance
   cp .env.example .env
   ```

2. **Edit `.env` for your installation:**

   | Variable | Purpose |
   | --- | --- |
   | `IMAGE_TAG` | The same published version tag for the API and web images. |
   | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Your database credentials and database name. |
   | `DATABASE_URL` | PostgreSQL connection URL using the internal `database` hostname and matching credentials. URL-encode credentials when needed. |
   | `APP_ORIGIN` | The exact public HTTPS origin of your application. |
   | `TRUST_PROXY` | Trusted proxy IPs/CIDRs for your deployment; defaults to `false`. |
   | `PLANNING_TIME_ZONE` | Calendar context for planning; defaults to `Europe/Madrid`. |
   | `WEB_PORT` | Local web port; defaults to `8080`. |

   Keep the environment file private. If the registry packages require authentication, sign in to `ghcr.io` with a credential that has package read access.

3. **Pull the images and start the application:**

   ```sh
   docker compose --env-file .env -f docker-compose.yaml pull
   docker compose --env-file .env -f docker-compose.yaml up -d
   ```

   Compose starts PostgreSQL, applies migrations through a one-shot service, and starts the API and web containers. Database data is stored in a persistent Docker volume.

4. **Connect your reverse proxy and register.** The web service binds to `127.0.0.1:8080` by default. Forward your configured HTTPS origin to that port, then open the application and create your account. For a containerized reverse proxy, adapt the Compose networking to your setup.

See the [Docker Compose and image delivery guide](specs/release-images.md) for registry access, image tags, migrations, and Portainer usage.

### Container images

| Component | Image |
| --- | --- |
| API | `ghcr.io/artcc/personal-finance-api` |
| Web | `ghcr.io/artcc/personal-finance-web` |

The release workflow builds images for **`linux/amd64`** and **`linux/arm64`**, tagged by release version and commit SHA. Configure an explicit version through `IMAGE_TAG`; the workflow does not publish a mutable `latest` tag.

## Technologies

| Technology | Purpose |
| --- | --- |
| TypeScript | Strictly typed application code |
| React, Vite, React Router | Web interface and navigation |
| TanStack Query | Remote state and cache management |
| React Hook Form, Zod | Forms and input validation |
| Tailwind CSS | Interface styling |
| NestJS, Fastify | Modular REST API |
| PostgreSQL, Prisma | Persistence and versioned database migrations |
| OpenAPI | API contract and generated TypeScript client |
| i18next, Intl | Spanish translations and locale-aware presentation |
| Vitest, Playwright | Unit, integration, and browser testing |
| Docker Compose, GitHub Actions | Self-hosted deployment and delivery workflows |

## Architecture

The project is a **modular monolith in a pnpm monorepo**, with separate web and API applications. Financial rules live in the API domain layer, independent of the framework and database. Application services orchestrate use cases and transactions; infrastructure handles persistence and external boundaries.

Money uses exact integer cents and decimal arithmetic. The web consumes a generated OpenAPI client, while financial calculations remain authoritative on the server.

```text
apps/api/             API, domain rules, persistence, and migrations
apps/web/             React application and Spanish translations
packages/api-client/  Generated API client package
infra/docker/         Container build and web-server configuration
specs/                Engineering documentation and feature specifications
docs/                 Static English project website
```

See the [architecture guide](specs/architecture.md) for module boundaries, data relationships, and transaction design.

## Development

The workspace uses **Node.js 26.8.2** and **pnpm 12.4.1**. Dependencies are pinned in the manifests and lockfile.

Local development uses `.env-dev.example` and `docker-compose.dev.yaml`; production uses `.env.example` and `docker-compose.yaml`.

For source installation and linting, the project-local helper keeps package-manager caches inside the repository:

```sh
node scripts/pnpm-local.mjs install --ignore-scripts
node scripts/pnpm-local.mjs lint
```

This installs dependencies without running lifecycle scripts. Prisma and API-client artifacts are generated by the build pipeline. See the [development guide](specs/development.md) for the database setup, generation order, development server, and available build/test commands.

Code and documentation are written in English. Application text lives in Spanish i18n resources with English semantic keys; user-entered names retain their original language.

## Documentation

| Guide | Contents |
| --- | --- |
| [Changelog](CHANGELOG.md) | Notable changes by version |
| [Product overview](specs/product.md) | Purpose, capabilities, and financial workflow |
| [Feature specifications](specs/specs/README.md) | Accounts, income, commitments, planning, financing, and investments |
| [JSON portability](specs/specs/data-portability.md) | Export format, import behavior, and compatibility rules |
| [Architecture](specs/architecture.md) | Modules, layers, persistence, and consistency |
| [Development](specs/development.md) | Local setup, scripts, generation, and CI |
| [Docker deployment](specs/release-images.md) | Image delivery, Compose configuration, and migrations |
| [UI/UX direction](specs/design/ui-ux.md) | Design language, interaction, and accessibility |

The standalone project website lives in [`docs/`](docs/). Open `docs/index.html` directly in a browser to view it; its HTML, CSS, JavaScript, and assets require no build step.

## Contributing

Contributions are welcome. Use [GitHub Issues](https://github.com/artcc/personal-finance/issues) to report a bug or discuss a feature, and open a pull request for focused changes.

Before working on the code, read the [project guidelines](AGENTS.md), [architecture](specs/architecture.md), and the relevant [feature specification](specs/specs/README.md). Keep financial calculations exact, preserve user isolation and historical records, and include meaningful tests for changes to financial behavior. Please use synthetic data when sharing examples or reproductions.

## License

Licensed under the [MIT License](LICENSE).

Copyright © 2026 Arturo Carretero Calvo.

## Author

**Arturo Carretero Calvo**

- [GitHub](https://github.com/artcc)
- [Website](https://www.arturocarreterocalvo.com)

<p align="center">
  <strong>Your plan. Your data. Your server.</strong>
</p>
