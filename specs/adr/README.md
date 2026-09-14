# Architecture Decision Records

An **accepted direction** reflects the previously accepted architecture/technology choice. A **proposed** record requires confirmation of its detailed policy before implementation. Follow-up choices are centralized in the [decision register](../decisions.md).

| ADR | Subject | Status |
| --- | --- | --- |
| [001](001-modular-monolith.md) | Modular monolith and boundaries | Accepted direction |
| [002](002-technology-stack.md) | Technology stack and monorepo | Accepted direction; phase-2 versions selected |
| [003](003-money-and-dates.md) | Exact money, decimals, dates, and rounding | Exact arithmetic accepted; policy details proposed |
| [004](004-monthly-history.md) | Saved monthly history and revisions | Historical preservation and D-05/D-11 lifecycle policies accepted |
| [005](005-authentication.md) | Single-owner authentication | Superseded by ADR 009 |
| [006](006-api-contract.md) | REST/OpenAPI and generated client | Accepted direction; wire details proposed |
| [007](007-internationalization.md) | English project and localized frontend | Accepted |
| [008](008-ui-ux-design.md) | Design-led financial interface | Quality requirement accepted; visual direction proposed |
| [009](009-independent-user-accounts.md) | Web registration and independent user accounts | Scope accepted; phase-3 implementation |

Each record describes context, decision, consequences, alternatives, and outstanding work. Changes that supersede an accepted decision require a new record linked to the old one.
