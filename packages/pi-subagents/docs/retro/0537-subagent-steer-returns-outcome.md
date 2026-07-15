---
issue: 537
issue_title: "pi-subagents Phase 20 Step 3: Subagent.steer returns an outcome"
---

# Retro: #537 — Subagent.steer returns an outcome

## Stage: Planning (2026-07-04T00:00:00Z)

### Session summary

Planned Phase 20 Step 3: move the non-running rejection rule inside `Subagent.steer` and have it return a discriminated `SteerOutcome` (`delivered` / `buffered` / `rejected`), so `SteerTool.execute` and `SubagentsServiceAdapter.steer` drop their `status !== "running"` pre-checks and switch on the outcome.
The plan is a single Tell-Don't-Ask refactor commit (class + both consumers + all three affected test files land together because the return-type change breaks them atomically), plus an excluded-path architecture-doc update.

### Observations

- Release marker is `ship independently` per the roadmap; it is refactor-only, so it cuts no release on its own and auto-batches — the plan's rationale says so explicitly (Refs #479).
- Confirmed exact behavior parity for the boolean mapping: unknown/`rejected` → `false`, `buffered`/`delivered` → `true`; and the `subagents:steered` event fires for buffered + delivered but not rejected (the pre-check returned before the emit today).
- The `service-adapter` "non-running" test currently mocks a bare `{ id, status } as Subagent` stub; since the adapter will call `record.steer` unconditionally, that fixture must switch to a real `createTestSubagent({ status: "completed" })` that owns the real `steer`.
- `SteerOutcome` will be exported from `subagent.ts` and re-exported via `types.ts` (both consumers already import `Subagent` from that barrel), keeping the re-export non-speculative.
- Planned extracting the delivered-path stats rendering into a private `renderDelivered` helper so `steer-tool.execute` clears the cyclomatic-< 10 target.
- Only `docs/architecture/architecture.md` needs a prose/diagram edit (the class-diagram `steer` signature); it is an excluded path, so no release impact.
  Historical plan/retro docs are frozen and left untouched.

## Stage: Implementation — TDD (2026-07-14T23:15:00Z)

### Session summary

Implemented Phase 20 Step 3 in one Red→Green→Commit cycle plus a docs commit.
`Subagent.steer` now returns a discriminated `SteerOutcome` and owns the non-running rejection; `SteerTool.execute` and `SubagentsServiceAdapter.steer` switch on the outcome, with the tool's stats block extracted into a private `renderDelivered`.
Test count went 960 → 961 (+1 for the new `rejected` case); the Tidy-First assessor found no preparatory refactoring warranted.

### Observations

- Deviation 1: `test/tools/steer-tool.test.ts` needed no edit — its `toContain` assertions already exercise all four outcome paths through the real `Subagent.steer` (`createTestSubagent`), so the plan's listed touch of that file was unnecessary.
- Deviation 2: the `subagent.test.ts` "flushes pending steers when session is created" test buffered a steer on a *queued* agent before `run()`; the new first-guard rejects non-running steers, so the test now calls `agent.markRunning(Date.now())` before steering.
  This is a faithful reflection of production semantics (callers only ever steered running agents) rather than a behavior regression — it surfaced the plan's documented "running-but-sessionless → buffered" edge case as a concrete test adjustment.
- The `service-adapter` non-running test fixture was swapped from a bare `{ id, status } as Subagent` stub to `createTestSubagent({ status: "completed" })` because the adapter now calls `record.steer` unconditionally — a real fixture-correctness fix, as the plan anticipated.
- Complexity target met: `steer-tool.ts` dropped off the `fallow health --targets` refactoring list (health score 4.9); `execute` cyclomatic is ~5.
- All gates green (`check`, root `lint`, full `test`, `fallow dead-code`); lockfile untouched.
- Pre-completion reviewer: PASS — no warnings; Step 1 (#535) notification/`toolCallId` invariant confirmed orthogonal and unregressed.

## Stage: Ship (worktree) (2026-07-15T00:05:00Z)

### Session summary

Pre-push checks pass clean on the worktree branch `issue-537-pi-subagents-phase-20-step-3-subagent-st`: `pnpm run lint` and `pnpm fallow dead-code` both green with no fixes needed.
Release marker is `ship independently` (refactor-only, no batch coordination required at land time); no follow-up work was deferred.

**Peer session transcript:** `/Users/chris/.pi/agent/sessions/--Users-chris-development-pi-pi-packages-worktrees-issue-537--/2026-07-14T22-54-31-689Z_019f62d6-cb09-781f-97a7-8174288a56e9.jsonl` — read with `read_session_file({ path: "<path>" })` for message-level verification at land/retro time.

### Observations

No new observations beyond the TDD stage — this is a clean handoff.
The branch is about to be rebased onto `origin/main`; the final `/retro 537` runs at the root after `/land-worktree 537`.
