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

[#292]: https://github.com/gotgenes/pi-packages/issues/292
[#398]: https://github.com/gotgenes/pi-packages/issues/398
[#526]: https://github.com/gotgenes/pi-packages/issues/526
[#530]: https://github.com/gotgenes/pi-packages/issues/530
[#556]: https://github.com/gotgenes/pi-packages/issues/556
