---
issue: 376
issue_title: "Extract the manager observer from index.ts into a class"
---

# Retro: #376 — Extract the manager observer from index.ts into a class

## Stage: Planning (2026-06-15T00:00:00Z)

### Session summary

Planned Phase 17 Step 5: extracting the inline `SubagentManagerObserver` literal from `index.ts` into a `SubagentEventsObserver` class under `src/observation/`, constructed with narrow `emit` / `appendEntry` / `NotificationSystem` deps.
The plan is a single red→green→commit extraction (class + tests + `index.ts` wiring in one commit) plus a docs commit marking the step complete.
Classified as a non-breaking, pure internal extraction with no observable behavior change.

### Observations

- The issue is the operator's own (author `gotgenes` matches the gh user) and the architecture doc already specifies Step 5 precisely, so the `ask-user` gate was skipped.
- The class + `index.ts` swap must land in one commit: `index.ts` is the sole call site of the literal being replaced, and the new class needs a consumer to satisfy `pnpm fallow dead-code`.
- Kept `buildEventData` in `notification.ts` (it is tested there) and imported it into the new module — avoids churning `notification.test.ts`.
- Used `refactor:` for the extraction commit, matching the precedent of Phase 17 Step 4 (#375); `refactor` is hidden from the release-please changelog.
- Two structural smells were noted as out of scope: the `record.notification?.resultConsumed` Law-of-Demeter chain (track-and-watch) and narrowing `NotificationSystem` to a two-method `CompletionNotifier` per ISP (the issue prescribes passing `NotificationSystem`).
- Wiring `pi.events.emit` / `pi.appendEntry` as arrow callbacks in `index.ts` avoids the `@typescript-eslint/unbound-method` trap; mirrors the existing `SettingsManager` emit pattern.
- Step 6 (#377) depends on this step; the plan pins the previously-untested event/notification dispatch invariants so Step 6 cannot regress them.

## Stage: Implementation — TDD (2026-06-15T18:40:00Z)

### Session summary

Completed 2 TDD cycles: (1) extracted `SubagentEventsObserver` into `src/observation/subagent-events-observer.ts`, added 15 tests covering all four observer methods, and updated `src/index.ts` to replace the inline literal — all in one coupled commit; (2) marked Phase 17 Step 5 ✅ Complete in the architecture doc with a Landed note.
Test delta: 994 → 1009 (+15); file count 63 → 64 test files; `index.ts` 226 → 177 lines.
Pre-completion reviewer: PASS.

### Observations

- The typed `vi.fn<(channel: string, data: unknown) => void>()` mock triggered `@typescript-eslint/no-unnecessary-type-assertion` on `mock.calls[0]!` indexing — fixed by switching the error-status assertions to `toHaveBeenCalledWith("subagents:failed", expect.anything())` and the success-status assertion to `toHaveBeenCalledWith("subagents:completed", buildEventData(record))`.
  This eliminated all raw `mock.calls[0]` indexing from the file, which is cleaner.
- The autoformatter (`pi-autoformat`) ran after writing `index.ts`, so the import block was reflowed; re-reading before further edits would be required in any follow-up session.
- Architecture doc: Step 4's header was already missing its ✅ Complete marker (it had a Landed note); the reviewer noted this was corrected correctly, not a regression.
- All five previously-untested observer-behavior invariants are now pinned by tests for the first time.
