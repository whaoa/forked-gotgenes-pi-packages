---
issue: 256
issue_title: "Extract WorktreeIsolation collaborator"
---

# Retro: #256 — Extract WorktreeIsolation collaborator

## Stage: Planning (2026-05-28T23:44:23Z)

### Session summary

Produced a numbered implementation plan for extracting a `WorktreeIsolation` collaborator (Phase 16, Step 1) that owns the worktree lifecycle (`setup`, `path`, `cleanup`) so `Agent` tells one collaborator instead of orchestrating `_worktrees` + `_isolation` + `worktreeState` itself.
The plan covers the new module, `Agent`/`AgentManager`/`service-adapter` wiring, the `WorktreeState` deletion, doc updates, and a 4-cycle TDD order.

### Observations

- Decision: fold `WorktreeState` into `WorktreeIsolation` (delete `worktree-state.ts`) rather than wrap it.
  The architecture target table already lists `WorktreeIsolation` as absorbing `worktrees` + `isolation` + `worktreeState`, and the user confirmed a fold preference when the doc had already decided it.
- `WorktreeManager.cleanup(wt, ...)` mutates `wt.branch` in place; `WorktreeIsolation` must store a mutable `WorktreeInfo` (`_info`) to preserve that behavior — flagged as the top risk.
- `AgentInit` net field change is −1 (removes `worktrees` + `isolation`, adds `worktree`), not −2 as the issue text loosely states; instance fields drop by 2 and `setupWorktree()` is removed.
- The `missing worktrees dependency` defensive branch becomes structurally impossible (collaborator is only built with a manager) and is dropped.
- Verified no consumer imports the `WorktreeCleanupResult`/`WorktreeInfo` re-exports from `worktree-state.ts` — they all import from `worktree.ts`, so deletion is safe.
- Step 2 (the integration) is a single commit because the type checker forbids removing `AgentInit` fields while call sites still pass them; bulk of `agent.test.ts` is untouched, only worktree helpers/describe blocks change.
- Doc updates needed: architecture class diagram + layout listing, and the package `SKILL.md` Lifecycle domain row (module count stays 9).
- This step is independent of Step 2 (#257, `ChildSessionFactory`) per the architecture's Track A.

## Stage: Implementation — TDD (2026-05-29T00:01:54Z)

### Session summary

Implemented all 4 planned TDD cycles: added `WorktreeIsolation` + unit tests, wired it into `Agent`/`AgentManager`/`service-adapter` (removing `_worktrees`/`_isolation`/`worktreeState`/`setupWorktree()`), deleted the folded `WorktreeState` class and its test, and updated the architecture doc + package skill.
Full suite green at 1047 tests (baseline 1053; +7 new `worktree-isolation` tests, −4 removed `setupWorktree` tests, −9 removed `worktree-state` tests); `check`, `lint`, and `fallow dead-code` all clean.

### Observations

- One pre-existing baseline failure: `rumdl` flagged 5 orphaned issue link definitions (`[#227]`–`[#232]`, minus the still-used `[#231]`) in `architecture.md`, introduced by an earlier Phase 15 archive commit.
  Fixed as a separate `docs:` cleanup commit before starting TDD to establish a green baseline.
- Deviation from a literal 1:1 test mapping: `WorktreeIsolation` deliberately exposes `path` + `cleanupResult` but no `branch` getter (branch is an internal `_info` detail surfaced via `cleanupResult`).
  The two `agent-manager.test.ts` tests that asserted `worktreeState.branch` now assert `record.worktree?.path` and `record.worktree?.cleanupResult`.
  Noted in the Step 2 commit body.
- `Agent.worktree` is `readonly` (set at construction), unlike the old mutable public `worktreeState` field.
  Tests that previously mutated `record.worktreeState = new WorktreeState(...)` after construction were reworked to pass a pre-`setup()` `WorktreeIsolation` via the constructor (`createSetUpWorktree` helper in `agent.test.ts`; `setUpWorktree` helper in `service-adapter.test.ts`).
- `createTestAgent` spreads `init` into the `Agent` constructor, so injecting `worktree` needed no helper change.
- The Step 2 integration landed cleanly in a single commit as the plan predicted; the type checker pinpointed every stale call site.
- Pre-completion reviewer: PASS (all deterministic checks, acceptance criteria, conventional commits, docs, code design, test artifacts, Mermaid, and dead-code gates green).
