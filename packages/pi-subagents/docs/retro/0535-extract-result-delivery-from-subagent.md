---
issue: 535
issue_title: "pi-subagents Phase 20 Step 1: extract result delivery from Subagent"
---

# Retro: #535 — pi-subagents Phase 20 Step 1: extract result delivery from Subagent

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Planned the extraction of the result-delivery domain out of the `Subagent` execution record.
The design dissolves `NotificationState`: `toolCallId` becomes a `Subagent.toolCallId` getter over `execution.parentSession`, and `resultConsumed` moves into `NotificationManager` as a `Set<string>` behind one tell operation, `consume(id)`, that also cancels the pending nudge.
Produced a three-step plan (prep getter → atomic core refactor → docs sync) filed at `docs/plans/0535-extract-result-delivery-from-subagent.md`.

### Observations

- The change is a clean Tell-Don't-Ask / Law-of-Demeter win: it collapses four `record.notification?.` reach-throughs (two in `get-result-tool`, one in the observer pre-check, one in `formatTaskNotification`) and a scattered two-object two-step reset (`markConsumed()` + `cancelNudge()`) into a single `notifications.consume(id)` tell.
- The core step is necessarily atomic — removing the `NotificationState` export and the `record.notification` surface breaks every importer and its tests at the type level in one commit — so the plan folds the manager change, both consumer updates, the file/interface deletions, and all consumer-test migrations into Step 2, with the `toolCallId` getter split out as a safe preparatory refactor (Step 1) to shrink it.
- The roadmap resolved the one design micro-decision (dissolve `NotificationState` into the manager vs. move it into the observation domain) explicitly toward the manager, so no `ask_user` gate was needed; the issue is the operator's own and refactor-only.
- Release is `mid-batch — defer`: Step 1 heads the `result-delivery` batch whose tail is Step 2 ([#536]); the `refactor:` commits cut no release on their own and batch into the next unhidden release.
- Preserved invariants flagged for the implementer: the "Bug 1" pre-await consumption ordering (pinned in `subagent-manager.test.ts`) and byte-identical `<task-notification>` XML (pinned by the `formatTaskNotification` tests).
- Found existing `notification-state.test.ts` and `notification.test.ts`; the former is deleted with the class, the latter gains manager-level `consume`/`consumed` coverage.

[#536]: https://github.com/gotgenes/pi-packages/issues/536
