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
