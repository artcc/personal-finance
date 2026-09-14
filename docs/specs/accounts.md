# Accounts and Allocation Destinations

Status: draft. Delivery: phase 4 for destinations; phase 5 for monthly allocations. D-06/D-11 affect allocation behavior.

## Purpose and scope

Represent where planned money belongs: bank accounts and their budgeting spaces. Let the owner see an actionable monthly distribution without recording everyday purchases or reading live bank balances.

Accounts owns destination configuration. Planning owns monthly allocation amounts and instructions. Neither module executes bank transfers.

## Conceptual data

| Entity | Fields |
| --- | --- |
| Account | `id`, `userId`, `name`, optional `institution`, optional display-only `reference`, `currency`, `archivedFromMonth`, `version` |
| Space | `id`, `accountId`, `name`, `archivedFromMonth`, `version` |
| Destination reference | `kind` (`account` or `space`), `id` |
| Monthly allocation | Owned by planning: destination snapshot, exact amount, purpose, linked source/plan-line references, version |

Account references are optional display metadata; no banking credentials or full account number is required. Names retain the owner's language. EUR is the only initial allocation currency.

## Rules

1. A space has exactly one parent account and inherits its currency. Nested spaces are not supported.
2. Creating a destination requires a trimmed, nonempty name; reject unsupported currency and invalid parent IDs.
3. Similar names may exist; identity is by ID rather than by text. UI can show institution/reference to disambiguate.
4. Archive destinations from an explicit planning month rather than deleting referenced history.
5. A future active source pointing to an archived destination requires reassignment or causes an actionable generation error. Historical snapshots remain readable.
6. Archiving an account with active spaces requires an explicit action including its affected spaces; never silently reparent them.
7. Destination totals separate direct account allocations from space allocations. The account group total is direct allocation plus its spaces, counted exactly once.
8. A transfer instruction is a funding action, not another planning charge.
9. A shared-cost obligation can have a monthly expense line and an allocation funding it, but only the expense line reduces availability.
10. Draft plans cannot close with unresolved/invalid current destination references. Closed plans display their snapshotted destinations even if later archived.

## Use cases

### Configure an account and spaces

Create an account, then optional spaces. API validates ownership and currency in the application boundary. A space cannot point to another space or an account outside the authenticated user's workspace. Derive `userId` from the session; never authorize a resource by a user ID supplied in the request body.

### Rename or archive

Require the expected version. Return affected future references before archiving so the owner can reassign them. Persist accepted changes transactionally. Never rewrite destination labels in closed plan revisions.

### View the monthly distribution

Planning supplies snapshotted allocations grouped by account, with direct and space amounts visibly distinguished. Show the planned source account for transfer instructions when known; retaining money in its receiving account does not require a fictitious transfer.

## Proposed HTTP surface

| Method / path | Purpose |
| --- | --- |
| `GET /api/v1/accounts` | List accounts and availability; support including archived records |
| `POST /api/v1/accounts` | Create an account |
| `PATCH /api/v1/accounts/{id}` | Update display metadata using expected version |
| `POST /api/v1/accounts/{id}/spaces` | Create a space |
| `PATCH /api/v1/spaces/{id}` | Update a space |
| `POST /api/v1/accounts/{id}/archive-preview` | Explain affected spaces and future sources |
| `POST /api/v1/accounts/{id}/archive` | Apply reviewed effective archive and reference changes |
| `POST /api/v1/spaces/{id}/archive` | Archive a space with reference checks |

Monthly allocation endpoints are specified in [monthly planning](monthly-planning.md).

## Errors

`ACCOUNT_NOT_FOUND`, `SPACE_NOT_FOUND`, `DESTINATION_UNAVAILABLE`, `DESTINATION_IN_USE`, `UNSUPPORTED_CURRENCY`, `INVALID_SPACE_PARENT`, `VERSION_CONFLICT`.

Only stable codes and safe field metadata reach the UI; all messages are localized.

## UI behavior

- Account groups show account name, secondary reference, direct allocation, space breakdown, and total.
- The configuration screen explicitly distinguishes destinations from observed balances.
- Empty state explains why an account is needed and offers one primary creation action.
- Archive confirmation lists affected items and the effective month.
- Loading retains the page heading and stable group placeholders.
- On a failed edit, retain entered data and offer retry. On conflict, offer reload with a clear explanation.
- Mobile presents account groups as stacked sections with editable amounts in a dedicated form, not an oversized desktop table.

## Acceptance examples

- **Space conservation:** EUR 100 allocated directly to an account and EUR 30 to its bills space produce an account group total of EUR 130, not EUR 160.
- **Shared-cost funding:** A EUR 280 monthly obligation and EUR 280 allocation reduce planned availability by EUR 280 in total.
- **Everyday spending:** With planned availability of EUR 600, allocating EUR 450 to everyday spending leaves availability at EUR 600; its allocation presentation shows EUR 150 of that available amount remaining to assign, subject to D-06.
- **Archive history:** A destination renamed or archived for October still appears with its September snapshot in the closed September plan.
- **Invalid future reference:** Archiving a destination used by an October commitment either includes a reviewed replacement or fails without partial changes.
- **Stale update:** Two edits from the same version cannot both overwrite the account successfully.

## Open decisions

D-06 defines the everyday-spending allocation policy. D-11 defines close behavior for an underfunded plan. Required display field lengths and pagination bounds must be specified in the implementation contract.
