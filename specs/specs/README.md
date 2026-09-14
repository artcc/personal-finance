# Feature Specifications

Status: initial specifications drafted for phases 4 and 5. These are implementation contracts under review, not implemented features.

## Initial specifications

| Specification | Owns | Dependencies |
| --- | --- | --- |
| [Authentication](authentication.md) | Web registration, login, independent accounts, revocable sessions | Canonical origin, credentials, user-scoped access |
| [Accounts](accounts.md) | Accounts, spaces, destination lifecycle; allocation collaboration | Monthly allocation rules |
| [Income](income.md) | Net salary, professional income, cash/tax/spendable projections | Exact money, tax policy, effective revisions |
| [Commitments](commitments.md) | Recurring charges, provisions, installments, funding classification | Rounding, calendar policy, accounts |
| [Monthly planning](monthly-planning.md) | Plan generation, overrides, allocation, close/reopen, historical views | Income and commitment projections |
| [Financing](financing.md) | Financing metadata, linked payment, reported debt | One canonical financing commitment |
| [Investments](investments.md) | Contributions, unit movements, manual valuations | Optional linked contribution commitment; no cost basis or fees |
| [JSON portability](data-portability.md) | Private export and compatible, validated import | Versioned financial file schema and empty destination workspace |

Each specification contains its scope, conceptual data, rules, use cases, proposed HTTP surface, errors, UI states, acceptance examples, and outstanding decisions. API schemas are generated only after implementation; the endpoint sketches below are design input, not deployed endpoints.

## Common conventions

- Authentication is required for private feature endpoints. Registration/login and health are explicitly public. Resolve `userId` from the server-side session; scope records, relationship validation, and exports to that user, returning not-found for out-of-scope identifiers.
- Identifiers are opaque strings; money, decimal quantities, calendar dates, and timestamps follow ADR 003.
- Editable records carry a version; mutations provide `expectedVersion` and return 409 on stale state.
- Field validation errors use stable English codes with field paths. UI copy comes from the locale resources.
- Collections use bounded pagination and documented filters once their OpenAPI contracts are implemented.
- Financial previews call backend use cases and never persist draft input as a side effect.
- Source revisions use `effectiveFromMonth`; at most one revision is selected for a source in a given month. That revision's calendar validity then determines inclusion under D-03.
- No plan read silently consults newer configuration to replace saved historical values.

## Subsequent specifications

Authentication, configuration, planning, financing, and simplified investment movements are implemented. The current phase adds compatible JSON export/import. Spreadsheet import, backup services, and operator-server actions remain excluded. The subsequently requested static website is implemented under `docs/`, with verification and publication pending; see [website design and behavior](../design/project-website.md).
