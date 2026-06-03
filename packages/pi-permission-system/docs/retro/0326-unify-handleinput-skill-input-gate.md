---
issue: 326
issue_title: "Unify handleInput's skill-input gate with the GateRunner pipeline"
---

# Retro: #326 — Unify `handleInput`'s skill-input gate with the `GateRunner` pipeline

## Stage: Planning (2026-06-02T00:00:00Z)

### Session summary

This session began as planning for #325 but pivoted.
Investigating #325's "residual cluster" decomposition (with the user steering toward Tell-Don't-Ask and "make the change that makes the change easy") surfaced that #325 is awkward only because `PermissionGateHandler` carries a wide, anemic dependency on the concrete `PermissionSession`.
Two preparatory refactors were identified and filed — #326 (unify `handleInput` with `GateRunner`) and #327 (extract a `ToolCallGatePipeline`) — and sequenced ahead of #325 in `docs/architecture/architecture.md` (Phase 3 Steps 9–11; downstream steps renumbered, diagram + tracks updated).
This planning session then produced the numbered plan for #326, the first pivot target.

### Observations

- **`handleInput` fully reduces to the runner.**
  The bespoke `applyPermissionGate` block, the eslint-disabled nested resolution ternary, and the manual `emitDecision` all map onto `GateRunner.runDescriptor` + `deriveResolution`.
  Confirmed the six resolution values (`policy_allow`, `policy_deny`, `auto_approved`, `user_approved`, `user_denied`, `confirmation_unavailable`) are reproduced exactly, so `input-events.test.ts` should pass unchanged.
- **`preCheck` preserves raw semantics.**
  `handleInput` resolves via `checkPermission` (no session ruleset), so `preCheck.source` is never `"session"` and the runner's session-hit branch is unreachable — the unification stays behavior-preserving on resolution.
  Whether skill input *should* honor session rules is left as a tracked open question, not changed here.
- **One deliberate behavior change.**
  Block-reason messages move from ad-hoc tag-less strings to runner-formatted ones (a new `skill_input` `DenialContext` kind), gaining the `[pi-permission-system]` tag like every other surface.
  Not asserted by any input test; surfaced only in the review log.
  Flagged in the issue and the plan.
- **Scope boundaries held.**
  #326 does **not** change the handler constructor or drop the `as unknown as PermissionSession` casts (that is #325), and does **not** tighten the `PermissionSession` API or touch `handleToolCall` (that is #327).
  The concrete-session mocks stay.
- **TDD shape.**
  Two commits: (1) additive `skill_input` denial context + formatter tests; (2) factory + `handleInput` rewrite + consumer-test updates folded together so the new `describeSkillInputGate` has a `src` consumer immediately (no dead-code window for fallow).
- **Known test edit.** `input.test.ts`'s "passes agentName…" assertion uses `expect.anything()` for the prompt's first arg; prompting now flows through the context-bound `promptPermission(details)`, so that one assertion must retarget `session.promptPermission`.
- **Process note.**
  Per the user's direction, this is a recursive "discover → note in architecture.md → file issues → backtrack" loop; expect further smells (e.g. the `ToolCallGatePipeline` shape in #327, and the `index.ts` composition root in #320) to be refined as those issues are planned.
