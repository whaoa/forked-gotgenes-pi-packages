---
issue: 421
issue_title: "pi-subagents: migrate activity-tracker readers to the record getters"
---

# Retro: #421 — Migrate activity-tracker readers to the record getters

## Stage: Planning (2026-06-17T00:00:00Z)

### Session summary

Produced a 5-step TDD plan for Phase 18 Step 2 — migrating the five activity readers (`widget-renderer`, `conversation-viewer`, `agent-menu`, `foreground-runner`, `notification`) off `AgentActivityTracker` and onto the `Subagent` getters added in Step 1 ([#420]).
The plan files at `packages/pi-subagents/docs/plans/0421-migrate-activity-readers-to-record-getters.md`.

### Observations

- **Two design forks surfaced and were resolved with the operator** via `ask_user`. (1) Finished agents currently show **no** turn count because the tracker is deleted on completion; reading off the record (which persists `turnCount`) makes finished lines show `⟳N`.
  Operator accepted this as the more-correct behavior — so the widget step is `feat:`, not `refactor:`. (2) How `WidgetAgent` exposes context percent: chose a precomputed `contextPercent` **field** + a `Subagent` → `WidgetAgent` projection in `AgentWidget` (over a `getContextPercent()` method on the snapshot), honoring the renderer's pure-data contract and dropping its `getSessionContextPercent(session)` reach-through.
  Operator's steer: "no sacred cows, especially in the UI — make the change that makes the change easy, then make the easy change."
- **Scope boundary with Step 3 ([#422]).**
  The producer plumbing (`foreground-runner` / `background-spawner` constructing trackers, `subscribeUIObserver`, the `runtime.agentActivity` map) stays — it is removed in Step 3.
  But the reader-held map deps in `notification`, `agent-widget`, and `agent-menu` are removed **here**, because Step 3's target list does not include those files.
  This means `cleanupCompleted` (which only deleted a map entry) becomes vestigial and is removed from `NotificationSystem`, rippling to `SubagentEventsObserver`.
- **Transient map leak between Steps 2 and 3** is noted as an accepted risk: after this step the runtime map is write-only and read by nobody, so it is inert until Step 3 deletes it.
- **Prep step (tidy-first):** Step 1 adds `turnCount` / `activeTools` / `responseText` / `maxTurns` shorthands to `createTestSubagent` so the reader-migration tests can seed activity on records.
- **Living-doc updates identified:** `.pi/skills/package-pi-subagents/SKILL.md` line 56 (`widget ─polls─→ AgentActivityTracker map`) and the architecture roadmap's Phase 18 Step 2 `Landed:` line.
  Completed historical plans under `docs/plans/` are point-in-time records and are not edited.
- **Shared-signature commits** flagged for `pnpm run check`: the widget step (`renderWidgetLines`) and the notification step (`NotificationSystem` + `index.ts` construction).
  Both `buildDetails` call sites and both viewer/menu constructor call sites must land in the same commit as their signature changes.

[#420]: https://github.com/gotgenes/pi-packages/issues/420
[#422]: https://github.com/gotgenes/pi-packages/issues/422

## Stage: Implementation — TDD (2026-06-17T17:00:00Z)

### Session summary

All 5 TDD cycles completed in one session.
The five activity readers (`widget-renderer`, `conversation-viewer`, `agent-menu`, `foreground-runner`, `notification`) were migrated off `AgentActivityTracker` and onto the `Subagent` record getters added in Phase 18 Step 1.
Test count went from 1058 to 1066 (+8).

### Observations

- **Step 2 (widget)** introduced the `WidgetAgent` → activity-field fold and the `AgentWidget.toWidgetAgent` projection.
  The accepted behavior change (finished agents now show `⟳N` from the persisted record) landed as `feat:` as planned.
  `renderWidgetLines` drops `activityMap`; renderer is now a pure function of plain data with no SDK-type reach.
- **Step 3 (viewer + menu)** was straightforward once `ConversationViewer` dropped `activity?: AgentActivityTracker`; the streaming indicator now reads `this.record.activeTools` / `this.record.responseText` directly.
  `AgentActivityReader` interface removed; `AgentsMenuHandler` constructor lost one parameter.
- **Step 4 (buildDetails + foreground runner)** required care around the pre-`onSessionCreated` phase: `streamUpdate` falls back to `recordRef?.turnCount ?? 1`, `execution.effectiveMaxTurns`, empty `Map()`, and `""` before the record reference is assigned.
  The `AgentTool` resume call site (`buildDetails(base, record)`) was already correct and needed no change.
- **Step 5 (notifications)** removed `NotificationSystem.cleanupCompleted` entirely (it only deleted a map entry).
  `SubagentEventsObserver.onSubagentCompleted` now returns early on `resultConsumed` rather than calling the removed method.
  The `NotificationManager` constructor drops the `agentActivity: Map` argument; `index.ts` needed one arg removed.
- **Post-commit SKILL.md fix**: the pre-completion reviewer (WARN) flagged that `subagent-events-observer.ts` was missing from the Observation domain table; fixed in a follow-up `docs:` commit.
- **Pre-completion reviewer**: WARN (non-blocking).
  Reviewer warning: SKILL.md Observation domain table listed 4 modules and omitted `subagent-events-observer.ts`; corrected before writing these notes.
