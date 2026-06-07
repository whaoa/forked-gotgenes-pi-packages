---
issue: 341
issue_title: "Slim PermissionSession to a state/lifecycle owner; unwind the fig-leaf interfaces"
---

# Retro: #341 — Slim PermissionSession to a state/lifecycle owner; unwind the fig-leaf interfaces

## Stage: Planning (2026-06-07T18:39:38Z)

### Session summary

Produced the numbered plan for Phase 4, Step 8 — the final Track C step that slims `PermissionSession` to a state/lifecycle owner.
Confirmed all three prerequisites are CLOSED (Step 1 `#334`, Step 6 `#339`, Step 7 `#340`) and read the session/resolver/runner/handlers/fixtures source plus the `#340` retro to pick up cross-session context.
Surfaced the one genuine design ambiguity via `ask_user`; the user chose Option A (retire the three handler interfaces, depend on the concrete `PermissionSession`, build real instances in tests).

### Observations

- The headline "`GateRunner(session, session, session)` → three different collaborators" was already two-thirds done by Steps 6–7: the runner is `GateRunner(resolver, session, gateway, reporter)`, so only the recorder role is still the session.
  The clean win is moving the recorder to `SessionRules` (rename `record` → `recordSessionApproval`, `implements SessionApprovalRecorder`); the runner call site is unchanged, only the injected object differs.
- Scope is larger than the issue's 3-file headline implies.
  The `#340` retro is explicit that Step 8 also removes the session's transitional query duplicates (`checkPermission`, `getToolPermission`, `getConfigIssues`, `getPolicyCacheStamp`) and rewires `AgentPrepHandler` + `SessionLifecycleHandler` to the resolver.
  `getSessionRuleset` is also dead in production (no caller since `#340` — verified by grep) and is removed.
- `PermissionGateHandler` does **not** gain a resolver dependency — its `GateRunner` already owns the resolver; it only needs the session's `activate` / `resolveAgentName`.
  Only the two non-gate handlers gain a concrete `PermissionResolver` parameter.
- Option A is a conscious trade-off against the package's "narrow interface, not concrete class" convention.
  It is justified because Step 1 made the session/resolver constructible, so tests build real instances (no casts) — the convention's mock-cast smell does not reappear.
  `ScopedPermissionResolver`, `ToolCallGateInputs`, `SkillInputGateInputs`, and `SkillPermissionChecker` stay narrow.
- The 104 `makeHandler` call sites only break if its override-bag keys or return shape change — `handler-fixtures.ts` uses its own `MockGateHandlerSession` mock, not the real class, so removing methods from `PermissionSession` does not touch them.
  The plan preserves `makeHandler`'s override surface to keep Step 5's blast radius to the fixture file itself.
- The existing `createSession` factory in `permission-session.test.ts` is the real-session fixture to promote into `test/helpers/session-fixtures.ts`; the hand-rolled stateful recorder in `external-directory-session-dedup.test.ts` collapses into a real `SessionRules` + real resolver sharing one ruleset.
- RPC (`permission-event-rpc.ts`) uses `permissionManager.checkPermission` directly and only `session.getRuntimeContext()`; `config-modal.ts` only reads `session.lastKnownActiveAgentName` — neither blocks the query-method removals.
- TDD order is lift-and-shift: promote the fixture, move the recorder, then retire one interface per commit (each deletion + handler retype + consumer-test rewrite folded together), then rebuild the gate-handler fixture, then docs.

## Stage: Implementation — TDD (2026-06-07T20:05:00Z)

### Session summary

Executed all six planned TDD steps plus docs: promoted the real-session fixture to `test/helpers/session-fixtures.ts`, moved the recorder role to `SessionRules` (`record` → `recordSessionApproval`, `implements SessionApprovalRecorder`), retired `SessionLifecycleSession` / `AgentPrepSession` / `GateHandlerSession` one per commit (rewiring `AgentPrepHandler` and `SessionLifecycleHandler` to a concrete `PermissionResolver`), rebuilt `makeHandler` on real session + resolver + `SessionRules` recorder, and updated architecture + skill docs.
Test count moved 1828 → 1823 (net −5: removed 6 `PermissionSession` delegation tests + 2 recorder/ruleset delegation tests, added 1 `SessionApprovalRecorder` conformance test on `SessionRules`; the remaining delta is the dedup-test rewrite collapsing onto real collaborators).
Pre-completion reviewer: PASS.

### Observations

- The plan held well; the lift-and-shift order kept the suite green at every commit and the predicted "104 `makeHandler` call sites stay put" was correct — only three handler-test assertions needed edits (`session.activate` → `forwarding.start` in `tool-call`/`input`, and `session.checkPermission` → `permissionManager.checkPermission` in `input`), because `makeHandler` preserved its override-bag surface (routing `checkPermission` overrides to the fake manager and session-state overrides to `vi.spyOn`).
- Biggest unplanned discovery (surfaced by the user mid-step): after Step 5 removed the last `implements`, `fallow` flagged four `PermissionSession` members (`getActiveSkillEntries` / `getInfrastructureReadDirs` / `getToolPreviewLimits` / `lastKnownActiveAgentName`).
  Root cause: `fallow` keys member liveness off `implements` clauses, so the structurally-consumed members went dark when the fig-leaf interfaces left.
  Resolved truthfully for the trio by declaring `PermissionSession implements ToolCallGateInputs` (a genuine pipeline-input contract, no import cycle — the pipeline does not import the session); this is now reflected in the plan's design but was not in the original Module-Level Changes.
  For `lastKnownActiveAgentName`, a named-interface attempt (`ActiveAgentNameReader`) did **not** satisfy `fallow` — the blind spot is the object-literal wiring in `index.ts` (config-modal receives `session` as an object-literal property, not a traced positional arg), not the missing contract — so it was reverted and a single justified suppression added (verified false positive; `config-modal.ts` reads it in production).
- Plan-completeness gaps caught at the end and fixed: the `skill-prompt-sanitizer.ts` `SkillPermissionChecker` doc comment still named `PermissionSession` (which no longer has `checkPermission`) — corrected to `PermissionResolver`.
- Marked Steps 5 (`#338`) and 7 (`#340`) `✓ complete` in the roadmap — both were CLOSED but unmarked (the user flagged `#338`).
  Step 8 (`#341`) stays unmarked until `/ship-issue` per convention.
- Reviewer's one WARN is informational: `PermissionResolver.checkPermission` is intentionally dual-role (ruleset-injecting `resolve` vs. raw `SkillPermissionChecker` pre-filter) — deliberate design carried over from `#340`, no change needed.
- `Edit`-tool friction: the Unicode box-drawing comment banners in `permission-session.ts` and the architecture doc twice defeated `oldText` matching (compounded by `pi-autoformat` reflow); fell back to a Python slice for the two block removals.
  Re-reading after autoformat resolved the rest.
