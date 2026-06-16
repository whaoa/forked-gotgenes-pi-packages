---
issue: 378
issue_title: "Consolidate lifecycle test fixtures"
---

# Retro: #378 — Consolidate lifecycle test fixtures

## Stage: Planning (2026-06-15T00:00:00Z)

### Session summary

Planned Phase 17 Step 7 — consolidating the lifecycle test clone families into shared/file-local helpers.
Produced `docs/plans/0378-consolidate-lifecycle-test-fixtures.md` with a six-step lift-and-shift TDD order and committed it.

### Observations

- The issue body is stale relative to `main`: it cites five families across six files (including `concurrency-queue.test.ts` and a 766-LOC `subagent-manager.test.ts`).
  Measuring with `fallow dupes -r packages/pi-subagents` against today's `main` shows **four** lifecycle families — Steps 1–6 already removed the queue (`concurrency-queue.test.ts` → `concurrency-limiter.test.ts`) and the `subagent.test.ts`/`concurrency-limiter.test.ts` families.
  The plan is written against the measured current state, not the issue snapshot.
- Design call: promote to `test/helpers/` only the genuinely cross-file duplication (the `createSubagentSession`-test mock-session builder, shared by `create-subagent-session.test.ts` and `create-subagent-session-extension-tools.test.ts` — `createFactorySession`).
  The manager and `subagent-session` families are intra-file (fallow recommends same-file extraction), so they get file-local helpers.
  Force-promoting intra-file families to `test/helpers/` would manufacture cross-file coupling that does not exist.
- Resisted extracting the `io.createSession.mockResolvedValue(...)` + `createSubagentSession(...)` invoke pair into a helper — two lines with per-test varying overrides; wrapping the system-under-test call would be procedure-splitting, not design improvement.
- Invariants at risk flagged: Step 1/Step 3's "every spawned agent has a `promise` at spawn" (pinned by the queued-promise test) and Step 3's "zero external `.promise`/`.notification` writes outside `subagent.ts`" (grep-verifiable).
  `arrangeQueuedPair()` must return the queued id; Step 4 folds in a re-grep.
- Baseline: package test duplication 669 lines / 3.3% across 20 files; the four lifecycle families total ~122 lines, so Step 7 alone should land below the 600-line goal (~547).
  Flagged as an Open Question pending the Step 6 `fallow dupes` measurement.
- Not breaking — test-only, no `src/`, public-surface, or behavior change.

## Stage: Implementation — TDD (2026-06-15T23:10:00Z)

### Session summary

Executed the lifecycle test fixture consolidation across 8 commits.
Added a shared `createFactorySession` builder, migrated the four lifecycle clone families, and (on operator steer) folded `create-subagent-session-extension-tools.test.ts` into `create-subagent-session.test.ts`, deleting the file.
Package test duplication dropped 669 → 512 lines (under the 600 goal); test count 1005 → 1010 (+5 `createFactorySession` self-tests); test files 64 → 63.
Pre-completion reviewer: PASS.

### Observations

- Plan premise was wrong on one point: extracting `createFactorySession` alone did **not** collapse the create-subagent-session families — the dominant clone was the arrange-act invoke block, not the builder.
  I first extracted a `runCreate`/`runCreateWith` act-helper to hit the metric, then the operator flagged it: mixing arrange + act hides the system under test, and arranges should be grouped by `describe`.
  Reworked to AAA — describe-scoped `beforeEach` for arrange, `createSubagentSession(...)` act kept explicit per test.
- The operator relaxed the roadmap's "lifecycle families ≤ 1" Outcome.
  Two families remain by design (the repeated act with test-specific arrange); documented as intentional in `architecture.md` Step 7.
  Lesson recorded: a clone-count metric is a weak signal for *test* code — AAA structure beats it, and chasing the metric produced the wrong abstraction before it was caught.
- `programTurns(session, listeners, turns)` is a legitimate arrange helper for the turn-limit tests (turn count is the meaningful input, not a discriminator flag); removed the restated-boundary comments per `code-design` (names/args over comments).
- Folding the extension-tools tests was safe because the recursion guard reads only the session mock's `getActiveToolNames`/`setActiveToolsByName`; the agent config and `type` don't affect those assertions (mocked `io.createSession` ignores `cfg.toolNames`).
- Surfaced three overlapping session-mock builders (`createMockSession`, `createSubagentSessionStub`, `createFactorySession`); filed [#412] as a follow-up rather than expanding #378 scope.
- Cross-step invariants verified intact: queued-agent "promise at spawn" ([#374]) test preserved through the `arrangeQueuedPair` extraction; zero external `.promise`/`.notification` writes in `test/lifecycle/`.

[#374]: https://github.com/gotgenes/pi-packages/issues/374
[#412]: https://github.com/gotgenes/pi-packages/issues/412
