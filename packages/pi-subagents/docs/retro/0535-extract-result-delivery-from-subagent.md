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

## Stage: Implementation — TDD (2026-07-13T00:00:00Z)

### Session summary

Implemented all three planned TDD steps: (1) added a `Subagent.toolCallId` getter and migrated `formatTaskNotification` to read it; (2) dissolved `NotificationState` entirely — `NotificationManager` now owns consumed-result state as a `Set<string>` behind one atomic `consume(id)` tell that adds to the set and cancels the pending nudge in a single call; (3) synced `docs/architecture/architecture.md` (class diagram, module tree, roadmap `✅` marker on Step 1) and `.pi/skills/package-pi-subagents/SKILL.md`.
Test count: 63 → 62 files (`notification-state.test.ts` deleted), 953 → 946 tests (net change from deleting redundant `NotificationState`-level tests and adding manager-level `consume`/`dispose` coverage).
Full monorepo `pnpm run check`, `pnpm run lint`, `pnpm run test`, and `pnpm fallow dead-code` all green; no lockfile changes.
Pre-completion reviewer: **PASS**.

### Observations

- **Design finding beyond the plan**: collapsing the old two-step reset (`markConsumed()` + `cancelNudge()`, called separately) into one atomic `consume(id)` tell doesn't just relocate the historical "Bug 1" race — it structurally eliminates it.
  The old design let code call `markConsumed()` without the paired `cancelNudge()`, leaving an armed timer; the new `consume(id)` always cancels the pending nudge as part of the same call, so that bug class is unrepresentable now (as long as `consume()` runs within the 200 ms nudge hold window).
  This meant the plan's "reproduces bug: consume() called after await" test (as literally specified) could no longer fail — rewrote it to pin both orderings (before and after awaiting) as passing invariants, with a comment explaining why post-await consumption is now also safe.
  The pre-completion reviewer independently hand-traced both rewritten tests against the real `NotificationManager`/`SubagentManager` wiring and confirmed the rewrite is a legitimate strengthening, not a coverage loss.
- The tidy-first-assessor found no preparatory refactoring needed — the plan's own Step 1 (lift `toolCallId` out first) already was the one legitimate tidy-first move, and Step 2's atomicity (the `NotificationState` deletion breaks every importer at once) argues against further splitting, not for it.
  It did flag two stale doc/title references to `NotificationState` outside the plan's file list (`test/helpers/make-subagent.ts`'s doc comment, and test titles in `background-spawner.test.ts` / `agent-tool.test.ts`) as "rejected as scope creep but directly caused by this change" — folded those one-line fixes into the Step 2 commit since they reference the deleted symbol.
- `NUDGE_HOLD_MS` (200 ms) is a load-bearing constant for the new `consume()`-after-await invariant: `consume()` only suppresses a nudge that hasn't fired yet, so any future increase to the hold window doesn't threaten correctness, but a *decrease* narrows the window in which `get-result-tool`'s post-await `consume()` call remains effective — worth a mental note if that constant ever moves.
- Session started with a `git pull --rebase` (not `--ff-only`) because a sibling worktree session was concurrently landing `pi-permission-system` work — confirmed with the operator before rebasing; the rebase was clean (2 local commits replayed onto new `origin/main`).
- Release remains `mid-batch — defer (batch "result-delivery")` per the plan; the release-please PR should stay open until Step 2 (#536) lands.

## Stage: Ship (worktree) (2026-07-14T03:11:43Z)

### Session summary

Pre-push checks passed clean: `pnpm run lint` (root) and `pnpm fallow dead-code` both succeeded with no findings; working tree had no lockfile drift.
The root will land via `/land-worktree 535`; the plan's `**Release:** mid-batch — defer (batch "result-delivery")` marker still applies — do not merge the release-please PR until Step 2 ([#536]) lands.

**Peer session transcript:** `/Users/chris/.pi/agent/sessions/--Users-chris-development-pi-pi-packages-worktrees-issue-535--/2026-07-14T01-13-22-838Z_019f5e2f-8e96-7cf5-b4b9-052ee1d0a14e.jsonl` — read with `read_session_file({ path: "<path>" })` for message-level verification at land/retro time.

### Observations

No new findings at this stage — pre-completion review already ran PASS during the TDD stage.
Branch is about to be rebased onto `origin/main`; no conflicts expected (no other work has landed on `main` touching `packages/pi-subagents/` since this branch's baseline pull).

[#536]: https://github.com/gotgenes/pi-packages/issues/536
