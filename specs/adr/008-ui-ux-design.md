# ADR 008 — Design-Led Financial Interface

Status: polished UI/UX requirement accepted; visual direction proposed. Date: 2026-09-14.

## Context

The owner explicitly requested a beautiful UI and UX. A large table mirroring the workbook would preserve data entry but miss the goal of making monthly planning clearer and more pleasant.

## Decision

Treat design as a delivery requirement before financial screen implementation. Create reviewed high-fidelity desktop/mobile screens, then implement them with shared tokens and tailored shadcn/ui components.

Proposed direction: a calm light interface, deep teal accent, restrained borders, strong typographic hierarchy, exact tabular financial figures, and generous but purposeful spacing. Emphasize planned availability and clear next actions rather than decorative charts.

Use progressive disclosure: summary first, source breakdown on demand, advanced annual/tax configuration in explicit expandable sections. Show historical and planning state clearly; never imply that plans are live bank balances.

## Consequences

- The monthly overview, allocation flow, and commitment editor establish the design baseline.
- Empty/loading/error/closed/shortfall states are designed alongside the happy path.
- Accessibility, keyboard behavior, mobile adaptation, localization, and text expansion are acceptance criteria.
- A token definition and screenshot review are required before treating visual work as complete.
- Theme direction can change after owner review without changing financial domain rules.

## Alternatives considered

Unthemed component defaults offer speed but do not meet the explicit design-quality goal. A custom component library from scratch adds maintenance cost; tailored accessible primitives are the preferred foundation.

## Follow-up

Follow the [design guide](../design/ui-ux.md) and [screen flows](../design/screen-flows.md). Resolve E-06 with the owner during phase 3. These documents are a design brief, not a claim that high-fidelity screens have already been produced.
