# ADR 007 — English Project, Localized Frontend

Status: accepted. Date: 2026-09-14.

## Context

The owner requires the entire project in English, with Spanish initial frontend copy and a path to additional languages.

## Decision

- English documentation, code, filenames, identifiers, comments, API codes, and test descriptions.
- Spanish frontend resources under the initial `es-ES` locale.
- i18next and react-i18next with semantic English keys and feature namespaces such as `common`, `auth`, `planning`, `accounts`, `income`, `commitments`, `financing`, `investments`, and `errors`.
- All user-facing copy, including accessibility labels, form validation, document titles, empty states, and notifications, resolves through i18n.
- Use interpolation and pluralization; do not construct translated sentences through concatenation.
- Use Intl for locale-aware presentation of supported exact money values, numbers, and calendar dates.
- Keep currency independent from locale; initial planning currency is EUR.
- API errors use stable codes that the frontend translates.
- Preserve user-entered text without automatic translation.
- Use `es-ES` as the initial supported fallback and render no language selector until a second language is available.

## Consequences

No English locale is required solely because source code is English. Localized resources contain the Spanish product copy; design documentation discusses that copy in English through semantic keys and illustrative meanings.

Text expansion, pluralization, and accessibility labels must be considered in components. A missing key must have a safe fallback in production and be detectable during development/CI; raw translation keys are not an acceptable final UI state.

## Alternatives considered

Hardcoded Spanish with later extraction risks missing error paths and accessibility labels. English-only UI conflicts with the owner's requirement.

## Follow-up

Implement translation namespaces and localized input parsing in phase 2/3. Add meaningful coverage for interpolation, locale input ambiguity, exact money presentation, and missing-resource handling.
