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

## Stage: Implementation — TDD (2026-07-09T14:00:00Z)

### Session summary

Implemented all four planned cycles from a green 2290-test baseline, landing Phase 9 Step 4.
Cycle 1 (`feat`) rides the child's `SessionApproval` into the forwarded request (`toForwardedData`, `PromptPermissionDetails.sessionApproval`, `ForwardedPermissionRequest.sessionApproval`); cycle 2 (`feat`) wires the serving-node scope selection end-to-end (new `approved_for_serving_session` state, two-step dialog, `buildForwardedScopeLabels`, `ForwardedRequestServer.applyGrantScope` + `recorder` dep, `index.ts`); cycle 3 (`test`) adds two composition-root round-trip tests; cycle 4 (`docs`) adds ADR-0006, marks the roadmap step complete, and updates `subagent-integration.md`.
Final suite 2310 tests (+20); pre-completion reviewer returned PASS.

### Observations

- **Pre-completion reviewer: PASS** — all deterministic gates green (`check`, root `lint`, `test` 2310, `fallow dead-code`); every named cross-step invariant held.
  No warnings.
- **Plan deviation (one file):** `src/authority/forwarding-io.ts` was not in the plan's Module-Level Changes but had to change.
  The tolerant request read (`readForwardedPermissionRequest`) reconstructs only known fields, so the new `sessionApproval` was silently stripped on read — the cycle-2 server red test (`records a whole-session grant`) surfaced it (recorder never called).
  Added an `asForwardedSessionApproval` narrowing helper mirroring the file's existing `asNullableDisplayString`/`asUiPromptSource` tolerant parsers.
  Lesson for future plans: when a plan adds an optional field to a serialized contract with a *tolerant* (field-allowlist) reader, list the reader as a touch point — an on-disk round-trip is not free.
- **Step 3 invariant held:** `processSingleForwardedRequest` stayed at ~43 lines (< 60) because `applyGrantScope` was factored as a separate method and the existing `recordForwardedDecision(...)` call site absorbed the one added call — verified with a raw line count, per the #557 retro's `fallow health` lesson.
- **#292 non-degraded broadcast held:** the single `permissions:ui_prompt` emit still fires once in `LocalUserAuthorizer.authorize` before the first `select`; the new second (scope) `select` lives downstream in `requestPermissionDecisionFromUi` and does not perturb it.
- **Two self-corrected lint slips** (both `@typescript-eslint/no-unnecessary-condition`): a test used `details && "sessionApproval" in details` (rewrote to `expect.not.objectContaining`), and `buildRequestOptions` used `pattern ?? "*"` on a `string`-typed element (rewrote to guard `patterns[0]` truthiness — a suggestion with no usable pattern simply offers no scope).
  Both caught by the pre-commit eslint hook, fixed before the commit landed.
- **Round-trip tests are real, not hollow:** they drive two real factory instances on separate buses with real 250ms polling — the parent's serving poll runs the actual two-step dialog via a scope-aware `ui.select`, records into the shared `SessionRules`, and the child re-forwards.
  Whole-session proves no second prompt + parent's own action session-approved; subagent-only proves scope containment (parent still prompts).
- **Serving-node-only recording confirmed end-to-end:** the whole-session choice returns `approved_for_serving_session`, `applyGrantScope` records + translates to plain `approved`, and the round-trip test confirms the child records nothing and re-forwards.

[#292]: https://github.com/gotgenes/pi-packages/issues/292
[#557]: https://github.com/gotgenes/pi-packages/issues/557
[#565]: https://github.com/gotgenes/pi-packages/issues/565
