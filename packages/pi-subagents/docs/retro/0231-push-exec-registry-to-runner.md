---
issue: 231
issue_title: "Push exec/registry relay deps to runner construction (Phase 15, Step 3)"
---

# Retro: #231 — Push exec/registry relay deps to runner construction

## Stage: Planning (2026-05-27T21:53:10Z)

### Session summary

Produced a 6-step TDD plan to move `exec` and `registry` from `AgentManager` to `ConcreteAgentRunner` via a new `RunnerDeps` interface.
The plan keeps `RunContext` (shrunk to 2 per-call fields) rather than dissolving it — #229 will likely dissolve it when `Agent.run()` calls the runner directly.

### Observations

- Confirmed `exec` and `registry` are pure relay deps on `AgentManager` — stored at construction, used only at lines 193–194 to forward into `runner.run()`.
- Chose `RunnerDeps` bag over separate positional params on `ConcreteAgentRunner` and `runAgent()` — groups all three runner-owned deps (`io`, `exec`, `registry`) in one interface, and `runAgent()` stays at 5 parameters.
- `AgentManagerOptions.registry` uses the concrete `AgentTypeRegistry` class; `RunContext.registry` uses the narrow `AgentConfigLookup` interface.
  The new `RunnerDeps.registry` uses `AgentConfigLookup` (ISP).
- Test churn is moderate (~20 `runAgent()` call sites change last param pattern) but mechanical — assertions stay identical.
- Added a `createRunnerDeps()` test helper to `runner-io.ts` to reduce per-file boilerplate in runner tests.

## Stage: Implementation — TDD (2026-05-27T22:05:32Z)

### Session summary

Implemented the 6-step plan in 4 commits (steps 3–5 merged).
All 1005 tests pass; no test count change.
Pre-completion reviewer returned PASS.

### Observations

- Plan steps 3, 4, and 5 could not be separate commits: removing `exec`/`registry` from `RunContext` (step 3) immediately caused TypeScript excess-property errors in `AgentManager` (step 4) and `index.ts` (step 5).
  Merged all three into one commit.
  The testing skill’s rule “when a TDD step changes an interface that has a single call site, the step must include updating that call site” applies.
- Shrinking `RunContext` to all-optional fields made pre-existing `as never` casts in `test/helpers/manager-stubs.test.ts` unnecessary (eslint `no-unnecessary-type-assertion`).
  Fixed as a lint cleanup in the doc commit.
- The `sed`-based bulk replacement for `runAgent(..., io)` → `runAgent(..., { io, exec, registry: mockAgentLookup })` missed one multi-line call site (the `rejects.toThrow` test wrapping the call in `expect()`).
  Caught immediately by the test run.
