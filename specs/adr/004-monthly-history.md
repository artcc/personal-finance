# ADR 004 — Monthly Snapshots and Revisions

Status: historical preservation accepted; lifecycle mechanics proposed. Date: 2026-09-14.

## Context

A changed subscription or investment plan must not rewrite previous monthly figures. A live query over current configuration cannot satisfy this requirement.

## Decision

Persist monthly plans with their calculation inputs, exact line amounts, source revisions/labels, policy version, and summary results. Use one owner/month identity with versioned plan revisions.

Proposed lifecycle:

```text
No plan -> Draft revision -> Closed revision
                              |
                        explicit reopen
                              |
                              v
                     New draft revision
```

Source changes do not alter saved drafts or closed revisions automatically. A draft refresh explicitly previews changes, replaces source-derived lines, and preserves line overrides with stable source references. Orphaned/conflicting overrides require a user decision before refresh is applied.

Closing and reopening use an expected version and run in a transaction. Reopening requires a reason and preserves the old closed revision. Only one current editable revision exists per plan. Lifecycle events record actor, time, reason, and revision identifiers.

## Consequences

- Historical display remains stable after source edits, archiving, or calculator changes.
- Additional persisted data is intentional and small at personal scale.
- Copying source descriptions protects historical readability but requires careful snapshot mapping.
- Repeated creation cannot reset manual edits; explicit refresh is a different use case.
- Concurrent changes return a conflict rather than last-write-wins data loss.

## Alternatives considered

- Always recompute from current data: loses history.
- Event sourcing: unnecessary implementation complexity for the initial scope.
- Only freeze totals: cannot explain historical amounts or their sources.

## Follow-up

Confirm D-05 and D-11. Specify reopening UI, blocked-close conditions, retention of revisions, and audit fields before lifecycle implementation. Unit and integration tests must prove history preservation.
