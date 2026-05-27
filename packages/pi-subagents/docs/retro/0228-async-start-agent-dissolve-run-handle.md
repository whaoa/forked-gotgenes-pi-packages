---
issue: 228
issue_title: "Convert startAgent to async/await, move run lifecycle to Agent (Phase 15, Step 2)"
---

# Retro: #228 — Convert startAgent to async/await, move run lifecycle to Agent

## Stage: Planning (2026-05-27T20:00:00Z)

### Session summary

Planned the async `startAgent` conversion and decided to dissolve `RunHandle` into Agent methods rather than moving it as a separate class.
Identified three preparatory steps (narrow promise type, add Agent methods, hoist worktree setup) that make the final async conversion a minimal diff.

### Observations

- The original issue proposed `Agent.createRunHandle()` as a factory, keeping RunHandle as a separate class.
  Analysis showed 5 of 6 RunHandle concerns are Agent state mutations — RunHandle is doing work that belongs on Agent.
  The clincher was `resume()` in `agent-manager.ts`: it duplicates RunHandle's pattern manually, and #232 wants to unify them.
  Dissolving RunHandle gives both `startAgent` and `resume` the same primitives (`completeRun`, `failRun`, `releaseListeners`).
- The synchronous-throw contract in `spawn()` for worktree failures requires hoisting `record.setupWorktree()` out of `startAgent` before the async conversion.
  Without this prep step, async `startAgent` would turn the throw into a rejected promise that `spawn()` doesn't catch.
- `promise: Promise<string>` → `Promise<void>` is safe because the resolved string is dead — every consumer reads `record.result` instead.
  Only one test assertion reads the resolved value.
- `completeRun`/`failRun` take `worktrees: WorktreeManager` as a parameter rather than storing it on Agent (ISP — only needed at run end, exactly two callers).

## Stage: Implementation — TDD (2026-05-27T20:40:00Z)

### Session summary

Implemented all 6 TDD steps: narrowed `promise` to `Promise<void>`, added 6 run lifecycle methods to Agent (+19 tests), replaced `RunHandle` with Agent methods (-85 LOC), hoisted worktree setup to callers, converted `startAgent` to async/await, and updated architecture docs.
Test count: 986 → 1005.

### Observations

- Step 1 (promise narrowing) required fixing 3 additional test files not listed in the plan: `make-agent.test.ts`, `service-adapter.test.ts`, `get-result-tool.test.ts`.
  All were trivial `Promise.resolve("done")` → `Promise.resolve()` changes and a cast removal.
- The lift-and-shift approach worked cleanly — each of the 5 implementation commits was small and independently green.
  The most impactful commit was step 3 (replace RunHandle, -96/+6 lines) which was risk-free because step 2 had already introduced the Agent methods.
- Pre-completion reviewer returned WARN for stale `AgentRecord` and `run-handle.ts` references in `architecture.md` class diagram and layout listing.
  These were pre-existing staleness from #227's rename that wasn't fully propagated to Mermaid diagrams.
  Fixed by amending the docs commit.
