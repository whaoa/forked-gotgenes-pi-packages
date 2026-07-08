---
issue: 555
issue_title: "pi-permission-system: introduce the Authorizer spine — interface, three implementations, once-per-session selection"
---

# Retro: #555 — Introduce the Authorizer spine

## Stage: Planning (2026-07-07T00:00:00Z)

### Session summary

Planned Phase 9 Step 1: introduce the `Authorizer` interface, its three implementations (`LocalUserAuthorizer`, `ParentAuthorizer`, `DenyingAuthorizer`), and a once-per-activation `selectAuthorizer`, replacing the three-way `hasUI`/`isSubagent`/deny dispatch smeared across `PromptingGateway`, `PermissionPrompter`, and `ApprovalEscalator`.
The direction was fully settled by the architecture doc's authority-model target and the Phase 9 roadmap, and the issue is the operator's own — so no `ask_user` gate was needed.
The plan lands in two behavior-neutral `refactor:` steps plus a docs step, filed as `packages/pi-permission-system/docs/plans/0555-authorizer-spine.md`.

### Observations

- **`GatePrompter` survives Step 1** — the runner and its fixtures (`gate-fixtures`, `handler-fixtures`, `external-directory-fixtures`) mock the stable `{ canConfirm, prompt }` surface, so the blast radius is confined to the ask-path internals + `index.ts` wiring + `permission-session.ts`/`descriptor.ts`/`session-logger.ts` imports + three test files + two fixtures.
  `canConfirm()` is dissolved later in [#556].
- **Split via a transitional wrapper** — Step 1 has `ParentAuthorizer` wrap the intact `ApprovalEscalator` (so all new modules are wired in one commit — no `fallow dead-code` failure — while the escalator's forwarding tests stay green); Step 2 folds the escalator in and removes the now-dead `hasUI`/`!isSubagent` arms plus the `ApprovalRequester` seam.
  This keeps each commit green and reviewable rather than one megacommit.
- **`selectAuthorizer(ctx, detection)` is roadmap shorthand** — the real signature is `selectAuthorizer(ctx, deps)`; the leaf authorizers need construction inputs (`events`, `requestPermissionDecisionFromUi`, `forwardingDir`, `registry`, `logger`) beyond `detection`.
  `AuthorizerSelectionDeps` relocates the composition inputs the escalator + prompter already receive — not a widening (the escalator sheds `requestPermissionDecisionFromUi`, which moves to `LocalUserAuthorizer`).
- **`activate` runs per tool call, not once per session** — confirmed via `permission-gate-handler.ts`.
  Selecting at each `activate` is behavior-neutral (predicates are session-stable, construction is a cheap allocation); the roadmap's "once per session activation" is honored in spirit, and a memoize-by-`ctx` optimization is explicitly out of scope.
- **`canConfirm` recomputed transitionally** — `AuthorizerSelection.activate` recomputes `hasUI || isSubagent` alongside `selectAuthorizer`'s own branch, a deliberate short-lived redundancy that keeps the ask path byte-identical until [#556] derives confirmability from a `DenyingAuthorizer` marker.
- **Invariants pinned** — review-log bracketing + yolo single `auto_approved` ([#526]), UI-prompt-event contract ([#292]), forwarding transport ([#530], [#398]); the plan names the test pinning each and adds a "does-not-emit" assertion for `DenyingAuthorizer`/`ParentAuthorizer`.
- **Doc surface** — a dedicated `docs/architecture/permission-prompter.md` exists and needs updating alongside the module-structure tree and the SKILL.md forwarding-test note; the phase-exit metrics table is left until the phase completes (Step 1 does not meet the `canConfirm`/role-interface targets).

## Stage: Implementation — TDD (2026-07-07T21:35:00Z)

### Session summary

Implemented Phase 9 Step 1 in two behavior-neutral TDD cycles plus a docs step, exactly as planned.
Step 1 added `Authorizer`/`selectAuthorizer`/`LocalUserAuthorizer`/`DenyingAuthorizer`/`AuthorizerSelection` and moved `PermissionPrompter` into `authority/`, with `ParentAuthorizer` wrapping the intact `ApprovalEscalator` as the planned transitional seam.
Step 2 folded `ApprovalEscalator`'s forwarding machinery directly into `ParentAuthorizer` and deleted the dead dispatch arms.
Step 3 updated `architecture.md`, `permission-prompter.md`, and `SKILL.md`.
Test count went from 2272 to 2275 (net +3, after consolidating ~36 old tests across two deleted files into ~39 new tests spread across five files).
Pre-completion reviewer: **PASS** (one non-blocking WARN, see below).

### Observations

- **Two genuine deviations from the plan's design pseudocode**, both flagged in commit bodies and confirmed sound by the reviewer:
  1. `PermissionPrompterApi` was **retained**, not removed as the plan's Module-Level Changes said — it evolved to the new `prompt(authorizer, details)` signature and became `AuthorizerSelection`'s narrow seam onto the concrete `PermissionPrompter` class.
     Needed because `PermissionPrompter`'s private `deps` field creates a TypeScript nominal brand — a structural `{ prompt: vi.fn() }` test mock cannot satisfy a concrete-class field type without a cast (the exact trap the `code-design` skill documents).
  2. `ParentAuthorizerDeps` dropped `detection` beyond what the plan's Design Overview pseudocode showed.
     Once the escalator's forwarding machinery folded into `ParentAuthorizer` (Step 2), the only use of `detection` was re-deriving `isSubagent` inside `waitForForwardedApproval` — but `selectAuthorizer` already guarantees `isSubagent === true` before constructing a `ParentAuthorizer`, so the re-check became a hardcoded `true` with an invariant comment, and the dependency dropped entirely.
- **`test/session-start.test.ts`'s minimal `ExtensionContext` mock surfaced a real timing change** — `AuthorizerSelection.activate` eagerly calls `selectAuthorizer` (and thus `detection.isSubagent(ctx)`, which reads `ctx.sessionManager.getSessionDir()`) on every activation, whereas the old `PromptingGateway.canConfirm()` was lazy and only evaluated when called.
  This is the intended behavior change (the roadmap's "predicates evaluated once per session activation" outcome), not a regression, but it required completing a stale test fixture that had never needed `getSessionId`/`getSessionDir` before.
- **The `ParentAuthorizer` forwarding round trip had no prior isolated unit test** — the pre-#555 `approval-escalator.test.ts` only covered the two now-deleted dead-arm tests (UI fast path, non-UI/non-subagent); the actual request-write/poll mechanics were only ever exercised via `composition-root.test.ts`'s full end-to-end "subagent registry sharing" test.
  Step 2 added a genuine round-trip test (temp forwarding dir, registered child/parent session pair, hand-written response file) — first pass **silently passed for the wrong reason**: an incomplete response payload (missing `responderSessionId`) fails `readForwardedPermissionResponse`'s validation and falls through to the same `{approved: false, state: "denied"}` the deny-path test expected, so the test asserted nothing about the real round trip.
  Completing the response payload's required fields turned it into a real assertion.
- **Reviewer WARN (non-blocking)** — the plan's Invariants section asked for an explicit "does-not-emit the UI-prompt event" test on `DenyingAuthorizer`/`ParentAuthorizer`.
  No such runtime assertion was added; instead neither class's deps bag has an `events` field at all, so non-emission is a compile-time guarantee rather than a tested one.
  The reviewer judged this a stronger guarantee than the plan asked for and did not block, but future `Invariants at risk` sections should note when a design choice structurally obsoletes a planned test rather than silently omitting it.
- **No steps remaining** — all three TDD-order steps landed; ready for `/ship-issue`.

[#292]: https://github.com/gotgenes/pi-packages/issues/292
[#398]: https://github.com/gotgenes/pi-packages/issues/398
[#526]: https://github.com/gotgenes/pi-packages/issues/526
[#530]: https://github.com/gotgenes/pi-packages/issues/530
[#556]: https://github.com/gotgenes/pi-packages/issues/556
