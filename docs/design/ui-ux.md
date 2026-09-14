# UI/UX Direction

Status: proposed financial visual direction; phase-3 access/private-shell components implemented. The responsive [visual review prototype](phase-3-preview.html) covers overview, allocation, annual commitments, and alternate states. Owner design approval, browser evidence for this change, and measured accessibility results remain pending.

## Design goal

Create a calm, precise personal-finance workspace that makes monthly decisions feel straightforward. The interface should feel intentionally designed rather than like a default admin template or a transcription of the spreadsheet.

The primary task is understanding and allocating a month. A decorative dashboard, live-looking bank balances, and charts without useful history would distract from that task.

## Experience principles

1. **Answer before detail.** Show the selected month and planned availability first, then explain the contributing amounts.
2. **Make financial meaning visible.** Distinguish income, reserve, charge, payment, and allocation in labels and layout.
3. **One dominant next action.** Preparing, allocating, or closing a month is more important than presenting every action at equal weight.
4. **Reveal complexity when relevant.** Annual schedules and tax details expand only when needed.
5. **Preserve confidence.** Show saved/draft/closed state, source revisions, conflicts, and calculation explanations explicitly.
6. **Use restrained decoration.** Typography, alignment, spacing, and useful contrast do most of the visual work.
7. **Design all states.** Empty, loading, failure, shortfall, and read-only experiences are first-class screens.

## Proposed visual language

### Color tokens

Use semantic tokens mapped to CSS variables and component variants. These initial values are design candidates; validate contrast before implementation acceptance.

| Token | Proposed value | Purpose |
| --- | --- | --- |
| `surface.canvas` | `#F5F7F8` | Page background |
| `surface.default` | `#FFFFFF` | Cards, forms, panels |
| `surface.subtle` | `#EDF2F3` | Grouped rows and neutral emphasis |
| `text.primary` | `#172B32` | Headings and primary data |
| `text.secondary` | `#52656D` | Supporting explanations |
| `border.subtle` | `#DCE4E7` | Structural separation |
| `border.control` | `#7C8D94` | Input boundary where contrast is required |
| `accent.default` | `#0F766E` | Primary action and selected navigation |
| `accent.strong` | `#115E59` | Hover/strong emphasis |
| `accent.subtle` | `#E8F5F2` | Positive availability emphasis and selected surfaces |
| `status.warning` | `#92400E` | Incomplete funding or attention required |
| `status.danger` | `#B42318` | Negative availability and destructive action |
| `status.info` | `#1D4ED8` | Neutral informational status |
| `focus.ring` | `#1D4ED8` | Visible keyboard focus |

Positive availability uses a lightly tinted surface and dark typography, not a saturated green dashboard. Negative availability replaces the status treatment with an explicit shortfall label and explanation. Do not rely on red/green alone.

Light mode is the proposed initial target. Dark mode is a later optional feature unless the owner prioritizes it; all tokens should still be semantic so theming does not require rewriting components.

### Typography

- Use a clean system sans-serif stack initially; adding a custom font requires a deliberate asset/dependency decision.
- Body: 16px with approximately 1.5 line height.
- Supporting text: 14px; metadata rarely below 12px.
- Page heading: 28–32px desktop, 24px mobile.
- Availability figure: 40–48px desktop, 32–36px mobile; responsive to amount length.
- Section heading: 18–20px; medium or semibold weight.
- Use tabular numerals for comparable amounts and right alignment in financial columns.
- Avoid all-uppercase labels for routine reading and excessive use of bold across every card.
- Monetary values must not be clipped, rounded into shorthand without disclosure, or allowed to overlap adjacent controls.

### Spacing and geometry

- Base spacing scale: 4, 8, 12, 16, 24, 32, and 48px.
- Desktop canvas padding: 32px; tablet 24px; mobile 16px.
- Content max width: approximately 1280px; reading/form columns approximately 640–760px.
- Sidebar: approximately 232px on desktop.
- Cards: 16px radius; controls: 10px; status pills reserved for small labels.
- Card padding: 24px desktop, 16px mobile; avoid nested cards unless they express a real hierarchy.
- Use a restrained shadow for floating surfaces and dialogs; use borders/spacing for ordinary grouping.

## Information architecture

Primary navigation follows the owner's tasks:

1. Monthly overview.
2. Allocation.
3. Commitments.
4. Income.
5. Accounts.
6. Financing.
7. Investments.

Settings, data export, and session actions are secondary. Data entry is manual; there is no import navigation or upload flow. Navigation exposes only implemented destinations. The selected month remains consistent between overview and allocation; source configuration screens distinguish their effective month from the active saved plan.

On desktop, use a persistent sidebar and a contextual page header. On mobile, use a compact top bar and a labeled navigation drawer. Avoid squeezing seven destinations into a bottom navigation bar.

## Core screen composition

### Monthly overview

- Header: month navigation, plan-state badge, one primary contextual action.
- Hero: planned availability, precise definition, and link/button to its calculation breakdown.
- Supporting summary: spendable income, monthly costs, annual provisions, and planned investment.
- Main body: upcoming payment dates and grouped commitments.
- Secondary column: allocation progress, unallocated cash, and next step.
- A historical comparison appears only when meaningful saved comparable months exist. Reopened revisions of one month must not be treated as separate months.

### Allocation

- Start with expected cash, tax reserve, and allocation status.
- Group destinations by account; show spaces indented inside their parent with distinct direct-account and total amounts.
- Present fixed allocations and the single residual allocation clearly.
- Separate commitment funding from allocation of planned availability.
- Use a compact, sticky reconciliation summary on long forms, with enough bottom space so it does not hide content or focused inputs.
- Show planned transfer instructions only after amounts reconcile, with clear planning semantics.

### Commitments

- Search/filter by name, kind, destination, and activity.
- Financial list prioritizes monthly impact, then frequency and due date.
- Create/edit in a focused page or spacious panel; use a dedicated page on mobile.
- Annual configuration separates total obligation, payment installments, and monthly provision preview.
- Future changes show a small before/after summary with effective month.

## Reusable component inventory

| Component | Important variants / behavior |
| --- | --- |
| App shell | Desktop sidebar, mobile drawer, active destination, skip link |
| Page header | Title, optional explanatory text, month context, primary action |
| Money display | Default, prominent, negative, unavailable; exact locale presentation |
| Metric panel | Main/secondary, loading, explanatory link; semantic definition |
| Plan status | Absent, draft, closed, pending refresh, conflict |
| Month control | Previous/next and accessible month selection; keyboard usable |
| Account group | Direct allocation, child spaces, group total, collapsed details |
| Form field | Label, helper text, error, disabled/read-only; no placeholder-only labeling |
| Money/decimal input | Locale-aware parsing, precision feedback, preserved input on failure |
| Data list | Desktop columns, mobile stacked rows, loading, empty, error |
| Confirmation dialog | Financial summary, reason input where required, focus restoration |
| Feedback banner | Error, conflict, shortfall, informational; actionable text |
| Empty state | Context-specific explanation and one useful action |
| Calculation breakdown | Reconciled income/charges with links to source details |

Use shadcn/ui primitives where appropriate, customizing tokens and variants once. Business components compose those primitives; avoid copying class lists across screens.

## Responsive behavior

- Review at 360px, 768px, and 1440px widths, and ensure reflow at 320 CSS pixels where applicable.
- Collapse to one content column on narrow screens; keep availability before supporting sections.
- Replace wide editable tables with stacked labeled rows. Horizontal page scrolling is unacceptable for ordinary forms and overview screens.
- Allow text wrapping and amount growth. Long user-entered names should wrap or provide an accessible full-value disclosure.
- Preserve primary actions without obscuring content or the on-screen keyboard.
- Do not hide important financial definitions, warnings, or plan state on mobile.

## Accessibility and interaction

- Target WCAG 2.2 AA, including text contrast, control contrast, reflow, and keyboard operation.
- Use semantic landmarks, heading order, labeled buttons, and programmatic form associations.
- Provide at least 44px comfortable touch targets for principal controls.
- Maintain a clear focus indicator and logical tab order; dialogs/drawers contain focus and restore it on close.
- Use textual status, sign, and icon/label alongside color for negative values and warnings.
- Announce relevant save/error state changes without repeatedly interrupting screen-reader users.
- Respect reduced-motion preferences; transitions should be short and functional, approximately 120–180ms.
- Do not require hovering to reveal essential explanations or actions.
- Avoid icon-only financial actions unless an accessible label and discoverable explanation are supplied.

## Localization and copy

Design documentation and the static review prototype use English meanings and illustrative labels. Implemented frontend copy belongs only in Spanish i18n resources, including registration, login, account/session management, navigation, and empty/error states.

Examples of intended keys: `planning.availableBalance`, `planning.cashToAllocate`, `planning.status.closed`, `planning.shortfall`, `commitments.monthlyProvision`, `accounts.directAllocation`, and `errors.planVersionConflict`.

Copy should be concise, specific, and nonjudgmental. Explain what an amount means and what the owner can do next. Avoid implying that a financial plan proves a bank balance, investment execution, or verified reserve.

## Required states

| State | Design requirement |
| --- | --- |
| First use | Explain configuration order; provide contextual actions without a long forced wizard |
| Month absent | Explain generation and show the selected month; do not display a fake zero summary |
| Loading | Stable skeletons for expected content; preserve useful navigation |
| Empty draft | Real zero totals plus guidance to add income/commitments |
| Error | Localized explanation, retry, preserved inputs where applicable |
| Negative availability | Prominent shortfall amount, cause breakdown, explicit acknowledgement at close if approved |
| Incomplete allocation | Remaining amount and affected destinations; disable close until reconciliation succeeds |
| Closed month | Persistent read-only state, historical revision information, explicit reopen flow |
| Stale edit | Explain concurrent/source changes, preserve input, offer review/reload |
| Missing valuation | Show unavailable information explicitly, never a fictional zero loss or value |

## Design acceptance gate

Before financial screen implementation:

1. Produce high-fidelity overview, allocation, and annual commitment screens for desktop and mobile.
2. Include key non-happy-path states and a clickable or equivalent reviewed navigation walkthrough.
3. Review visual direction with the owner and record the result in E-06.
4. Define implemented tokens and reusable component variants.

Before accepting implemented screens, compare browser screenshots to the reviewed design, inspect representative widths and keyboard interactions, and verify localized copy. Ask before running automated visual/accessibility checks. This document alone is not evidence that the visual acceptance gate has passed.
