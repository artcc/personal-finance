# ADR 004 — Monthly Snapshots and Revisions

Status: historical preservation and D-05/D-11 lifecycle policies accepted by the owner. Date: 2026-09-14. Phase-5 implementation is present; runtime verification remains pending in CI.

## Context

A changed subscription or investment plan must not rewrite previous monthly figures. A live query over current configuration cannot satisfy this requirement.

## Decision

Persist monthly plans with their calculation inputs, exact line amounts, source revisions/labels, policy version, and summary results. Use one owner/month identity with versioned plan revisions.

Approved lifecycle:

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

Under approved D-11, negative availability does not automatically prohibit closing. The owner must explicitly acknowledge the shortfall, and destination allocations must still reconcile exactly to expected cash. Keep the shortfall in the closed snapshot; closing is not evidence that all obligations were funded or paid.

## Consequences

- Historical display remains stable after source edits, archiving, or calculator changes.
- Additional persisted data is intentional and small at personal scale.
- Copying source descriptions protects historical readability but requires careful snapshot mapping.
- Repeated creation cannot reset manual edits; explicit refresh is a different use case.
- Concurrent changes return a conflict rather than last-write-wins data loss.

The implementation uses two planning tables and the existing financial audit-event table. A plan-level version increases across both edits and reopenings, while revision numbers identify historical snapshots. Source snapshot JSON and exact saved summaries are validated against the supported `planning-v1` structure. Database protection prevents updates to closed revision rows; reopening inserts a new row instead.

## Alternatives considered

- Always recompute from current data: loses history.
- Event sourcing: unnecessary implementation complexity for the initial scope.
- Only freeze totals: cannot explain historical amounts or their sources.

## Follow-up

D-05 and D-11 are confirmed. Implement their reopening/confirmation UI, close preconditions, preserved revisions, and audit fields according to the monthly-planning spec. Unit and integration tests must prove history preservation, explicit deficit acknowledgement, and allocation reconciliation.
