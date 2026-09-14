# Architecture Decision Records

An **accepted direction** reflects the previously accepted architecture/technology choice. A **proposed** record requires confirmation of its detailed policy before implementation. Follow-up choices are centralized in the [decision register](../decisions.md).

| ADR | Subject | Status |
| --- | --- | --- |
| [001](001-modular-monolith.md) | Modular monolith and boundaries | Accepted direction |
| [002](002-technology-stack.md) | Technology stack and monorepo | Accepted direction; versions pending |
| [003](003-money-and-dates.md) | Exact money, decimals, dates, and rounding | Exact arithmetic accepted; policy details proposed |
| [004](004-monthly-history.md) | Saved monthly history and revisions | Historical preservation accepted; lifecycle proposed |
| [005](005-authentication.md) | Single-owner authentication | Proposed implementation |
| [006](006-api-contract.md) | REST/OpenAPI and generated client | Accepted direction; wire details proposed |
| [007](007-internationalization.md) | English project and localized frontend | Accepted |
| [008](008-ui-ux-design.md) | Design-led financial interface | Quality requirement accepted; visual direction proposed |

Each record describes context, decision, consequences, alternatives, and outstanding work. Changes that supersede an accepted decision require a new record linked to the old one.
