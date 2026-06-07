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
