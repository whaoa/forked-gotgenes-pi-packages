---
issue: 558
issue_title: "pi-permission-system: grant-scope selection on forwarded approvals"
---

# Retro: #558 — grant-scope selection on forwarded approvals

## Stage: Planning (2026-07-09T00:00:00Z)

### Session summary

Planned Phase 9 Step 4: offering the human at the serving node a scope ("this subagent only" vs "the whole session") when approving a forwarded "for this session" request.
The design rides the child's already-computed `SessionApproval` suggestion into the `ForwardedPermissionRequest`, adds a serving-node-internal `approved_for_serving_session` decision state, and records a whole-session grant into the serving node's shared `SessionRules` so [#557]'s serve-time evaluation suppresses future prompts for the parent and its children.
Committed `docs/plans/0558-forwarded-grant-scope-selection.md` (`ad5403ab`) as three implementation cycles (feat/feat/test) plus a docs cycle.

### Observations

- **Two `ask_user` decisions drove the design** (operator is the issue author, `gotgenes`): (1) a whole-session grant records **only** on the serving node — the child gets a plain `approved`, does not record, and re-forwards its next identical action (single source of truth over child-avoids-re-forward); (2) a **two-step** dialog — the base 4-option prompt is unchanged, and picking "for this session" opens a second scope `select` only for a forwarded ask that carries a suggestion.
  The two-step choice kept `requestPermissionDecisionFromUi`'s local-ask path byte-identical.
- **`approved_for_serving_session` is serving-node-internal**: the dialog produces it, `ForwardedRequestServer.applyGrantScope` records + translates it to `approved` before the response is written, so it never reaches disk or the child.
  Added to the union and `isPermissionDecisionState` (guard completeness) but the on-disk `ForwardedPermissionResponse.state` stays within the four legacy values.
  Grep-verified the only state branch sites are the dialog and `permission-gate.ts` (checks `approved_for_session` only, unaffected) — no `never`-exhaustive switch, so widening the union is low-ripple.
- **Marker vs new-state**: considered a `grantScope` marker (like `autoApproved`/`confirmationUnavailable`) but chose an honest new state; the server's translation to `approved` is the load-bearing part either way, and a marker leaves the state saying "subagent" while meaning "serving."
- **Invariants at risk carried forward from [#557]**: the [#292] non-degraded broadcast (emit fires once before the scope select), the one-emit-site rule, and the `processSingleForwardedRequest < 60 lines` health target (hold by keeping `applyGrantScope` a separate method; the #557 retro's explicit lesson was to run `pnpm fallow health`, not just `fallow dead-code`).
- **Doc surfaces beyond `src/`**: `docs/subagent-integration.md` (README-linked) describes the forwarding approve/deny flow and needs the scope choice; the roadmap step is marked complete in the implementation docs commit (package-skill rule), and a new ADR-0006 records the two decisions.
- **Design-review pass**: the widened interfaces (`PromptPermissionDetails` +1, `ForwardedPermissionRequest` +1, `ForwardedRequestServerDeps` +1 narrow `SessionApprovalRecorder`, `RequestPermissionOptions` +1) each follow an established precedent (Step 3's `forwarding` field, the existing optional display fields) and introduce no LoD/output-argument/scattered-decision smell; `SessionApproval.toForwardedData()` avoids field reach-through in `GateRunner`.
- **No follow-ups filed**: the three-way scope and cross-cwd/cross-surface portability are admitted-not-shipped, already tracked by the roadmap's resolved-direction 4 and [#565] — nothing speculative to file.

[#557]: https://github.com/gotgenes/pi-packages/issues/557
[#565]: https://github.com/gotgenes/pi-packages/issues/565
