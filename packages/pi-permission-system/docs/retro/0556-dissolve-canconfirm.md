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

## Stage: Implementation — TDD (2026-07-08T13:32:00Z)

### Session summary

Executed all three planned TDD cycles: (1) additive `confirmationUnavailable` marker on `PermissionPromptDecision` + `DenyingAuthorizer` + `PermissionPrompter` preserve-signal; (2) the atomic dissolve — deleted `gate-prompter.ts`, introduced the single-method `AskEscalator` seam (`escalate`), stripped `canConfirm` from `permission-gate.ts`/`runner.ts`/`helpers.ts`/`authorizer-selection.ts`, and migrated ~11 test files + 3 fixtures off the two-method `{ canConfirm, prompt }` mock; (3) docs — marked Phase 9 Step 2 `✅` (heading + Mermaid node), corrected the roadmap Outcome to the uniform-escalation reality, updated `permission-prompter.md` and the package SKILL.
Test count: 2287 → 2280 in `pi-permission-system` (net -7); full suite, `tsc`, root lint, and `fallow dead-code` all green.

### Observations

- **`canConfirm` fully dissolved to 0 in `src/`** — the only surviving mentions are two historical references in the `authorizer-selection.ts` doc comment (explaining what `AskEscalator` replaced).
- **Method renamed `prompt` → `escalate` on the gate seam.**
  Deviated slightly toward more churn than a bare `prompt`-keeping rename, but the per-file `prompter.prompt` sites were disjoint (AskEscalator mocks vs `PermissionPrompterApi` mocks live in different files), so per-file `sed` was unambiguous.
  `PermissionPrompter.prompt(authorizer, details)` keeps its name — `AuthorizerSelection.escalate()` now reads as calling `PermissionPrompter.prompt()`, a clean disambiguation.
- **Deviation 1 (test removed):** dropped the `external-directory-integration.test.ts` test "writes review-log entry with confirmation_unavailable when no UI".
  Under uniform escalation with an injected fake `AskEscalator`, the gate no longer writes a standalone `blocked` entry and the fake bypasses `PermissionPrompter`, so the integration layer cannot assert that entry; the behavior moved to the new `permission-prompter.test.ts` unit test (Step 1).
  Reviewer confirmed this is legitimately redundant, not lost coverage.
- **Deviation 2 (files not enumerated):** also migrated `external-directory-session-dedup.test.ts` and `external-directory-integration.test.ts` as consumers of `external-directory-fixtures.ts` (whose exported prompter type changed `GatePrompter` → `AskEscalator`).
  A plan file-list gap, not an implementation gap — `tsc` would have caught a miss.
  Also updated `makeDedupWiring`/`makeDeduplicatingHandler` signatures in the fixture (the plan named the fixture but not these two helpers).
- **Review-log behavior change is intentional.**
  The unavailable path is now `waiting` + `denied` (`resolution: confirmation_unavailable`, preserved via the marker) instead of a single `blocked`/`confirmation_unavailable` entry; the `permissions:decision` broadcast is unchanged.
  Recorded in the corrected roadmap Outcome so it is not later read as a regression.
- **Pre-completion reviewer: PASS.**
  Mermaid (4 charts parse), dead code (fallow zero), cross-step invariants (all four Step-1 invariants verified intact: waiting-before-consult ordering, no UI-event from `DenyingAuthorizer`, yolo single `auto_approved`, `confirmation_unavailable` decision event now marker-driven).
  No warnings.
