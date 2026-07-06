---
issue: 528
issue_title: "pi-permission-system: extract a shared forwarded-permission test harness"
---

# Retro: #528 — pi-permission-system: extract a shared forwarded-permission test harness

## Stage: Planning (2026-07-06T00:00:00Z)

### Session summary

Planned the extraction of a shared forwarded-permission test harness (`test/helpers/forwarding-fixtures.ts`) from the forwarder-family test files, Phase 8 Step 4 of the roadmap.
The plan fully migrates `test/permission-forwarder.test.ts` (the sole file carrying the 43-line temp-dir clone ×2), opportunistically touches `test/permission-forwarding.test.ts`, and leaves `test/forwarding-manager.test.ts` unchanged.
Release recommendation: ship independently (test-only, `hidden: true` `test:` changelog type).

### Observations

- Read all three files; the issue's "Why" overclaims duplication in `forwarding-manager.test.ts` and `permission-forwarding.test.ts`.
  The real cross-file clone lives almost entirely in `permission-forwarder.test.ts`.
  `forwarding-manager.test.ts` uses an `ExtensionContext`-cast ctx (not `ForwarderContext`), mocks `subagent-context`, does no temp-dir I/O, and its scaffolding is file-local — so it is a documented Non-Goal.
  `permission-forwarding.test.ts` tests pure functions whose inline option objects are the *act's inputs* (testing skill: don't hide them), so only its `SubagentSessionRegistry` arrangement is a candidate.
- Used `ask_user` for two genuine forks.
  Operator chose: (1) handle + `afterEach` cleanup (`createForwardingTempDir` returning `{ forwardingDir, location, writeRequest, cleanup }`) over a callback wrapper; (2) opportunistic migration over forcing all three files onto the harness.
- The "response builder" the issue names is the in-memory UI decision (`makeUiDecision` → `PermissionPromptDecision`), not a disk `ForwardedPermissionResponse` — the three files never write responses; only `composition-root.test.ts` does, and that is out of scope.
- Reuse `makeEvents` from `#test/helpers/handler-fixtures` (already exactly `{ emit, on }`) rather than re-implementing it; precedent set by `external-directory-fixtures.ts` and `manager-harness.ts` (#525).
- Structured as refactor cycles (green throughout, no red phase) with `pnpm fallow dead-code` gating each step so fixtures always land with a consumer.
- `makeSubagentRegistry` (Step 2) is flagged borderline — its adoption is a deferred implementation judgment call, no follow-up issue needed.
- No `src/` symbol changes, so the only doc touch is the Phase 8 Step 4 `✅` marker in `architecture.md` (step heading + `S4` Mermaid node), landed in the implementation commit per the package skill.

## Stage: Implementation — TDD (2026-07-06T15:40:00Z)

### Session summary

Executed all three plan steps as refactor cycles (green throughout, no red phase).
Created `test/helpers/forwarding-fixtures.ts` and fully migrated `permission-forwarder.test.ts`, adopted `makeSubagentRegistry` in `permission-forwarding.test.ts`, and marked Phase 8 Step 4 complete in `architecture.md`.
Test count is unchanged (2293 pass in pi-permission-system); this was arrangement-only deduplication.

### Observations

- No deviations from the plan.
  Both optional decisions the plan flagged resolved toward inclusion: `makeSubagentRegistry` (Step 2) read cleaner across the 5 registry call sites, so it was adopted; `forwarding-manager.test.ts` was left unchanged exactly as the Non-Goals predicted (its `ExtensionContext`-cast ctx and fake-timer polling do not overlap the harness).
- `makeUiDecision` doubles as the default for `makeForwarderDeps.requestPermissionDecisionFromUi`, so the approving-UI default is centralized.
  Reused `makeEvents` from `#test/helpers/handler-fixtures` rather than re-implementing the `{ emit, on }` mock.
- The missing-`responses/` race test drove the `createResponsesDir` option on `createForwardingTempDir` — the one place the handle needs to deviate from the default layout.
- All `expect(...)` assertions preserved byte-identical (reviewer diffed line-by-line and confirmed).
- Pre-completion reviewer: PASS (all deterministic checks green; code design, docs, Mermaid, dead-code all PASS; acceptance-criteria/cross-step/follow-up lenses SKIP as not applicable to a test-only change).
