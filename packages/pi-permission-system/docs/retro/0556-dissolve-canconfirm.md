---
issue: 556
issue_title: "pi-permission-system: dissolve canConfirm() — the ask path always escalates to the Authorizer"
---

# Retro: #556 — dissolve `canConfirm()` — the ask path always escalates to the `Authorizer`

## Stage: Planning (2026-07-08T00:00:00Z)

### Session summary

Planned Phase 9 Step 2: dissolve `canConfirm()` (15 occurrences across 5 `src/` modules → 0) by deleting `gate-prompter.ts`, making the `ask` path always escalate to the selected `Authorizer`, and driving `confirmation_unavailable` from a `confirmationUnavailable?: true` decision marker (mirroring the existing `autoApproved` marker).
Two design forks were resolved interactively with the operator and drove the Goals and Design Overview.
Plan committed as `0556-dissolve-canconfirm.md`; TDD order is 3 steps (additive marker → atomic dissolve → docs).

### Observations

- **Byte-identical constraint relaxed by the operator.**
  The issue mandated "blocked-when-unavailable review entries byte-identical to today's," which conflicts with routing `DenyingAuthorizer` through `PermissionPrompter` (it writes `waiting` before consulting the authorizer, so the marker — known only post-`authorize` — cannot suppress the bracketing without reordering).
  The operator explicitly deprioritized byte-identical output in favor of a "clear, coherent state," which unlocked **uniform escalation**: `DenyingAuthorizer` flows through `PermissionPrompter` like every authorizer, with zero special-casing.
  This is cleaner than the two alternatives (selection-bypass branch, or a `waiting`-reorder in `PermissionPrompter`).
- **Signal preserved, not lost.**
  Chosen sub-decision: surface the marker as `resolution: confirmation_unavailable` in `PermissionPrompter`'s `denied` review entry (one marker-read), so the "no authority reachable" diagnostic survives in the review log as well as the decision event.
- **`DenyingAuthorizer` is the headless-root case, not the subagent case.**
  `selectAuthorizer` picks it only when `!hasUI && !isSubagent`; a subagent with a live parent selects `ParentAuthorizer`.
  Today the `DenyingAuthorizer` ask path is unreachable at runtime (`canConfirm` short-circuits); this step makes it reachable.
- **The gate role collapses to a single-method seam.**
  `GatePrompter` (`canConfirm` + `prompt`) becomes `AskEscalator` (`escalate`), co-located with `AuthorizerSelection` in `authorizer-selection.ts`.
  Renamed `prompt` → `escalate` for coherence with the target model; the internal `PermissionPrompter.prompt` delegation keeps its name (reads as `escalate()` calling `prompt()`).
- **Deliberate roadmap-Outcome correction flagged.**
  The `architecture.md` Step 2 Outcome currently claims "byte-identical" — Step 3 must correct it to the uniform-escalation reality so a later reviewer does not read the old wording as a regressed invariant.
- **Step 2 is necessarily atomic (~10 test files).**
  Deleting the `GatePrompter` export + removing `canConfirm` from `PermissionGateParams` + changing `deriveResolution`'s signature all break `runner.ts` and its tests at the type level together.
  Step 1 (additive marker) shrinks Step 2; the fan-out edits are single-token retypes (`GatePrompter["prompt"]` → `AskEscalator["escalate"]`).
- **Grep surface enumerated.**
  Only `authorizer-selection.ts` and `runner.ts` import `GatePrompter` in `src/`; `index.ts` and `permission-session.ts` are untouched (they hold `AuthorizerSelection` by value / via `AuthorizerSelectionLifecycle`).
  Docs to update: `architecture.md`, `permission-prompter.md`, package SKILL fixture note.
