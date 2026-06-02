---
issue: 316
issue_title: "Fold PermissionPrompter.buildForwardingDeps() into the injected forwarder"
---

# Retro: #316 — Fold `PermissionPrompter.buildForwardingDeps()` into the injected forwarder

## Stage: Planning (2026-06-02T17:34:23Z)

### Session summary

Produced the implementation plan for Phase 3, Step 3 of the package roadmap — the second issue in the forwarding lift-and-shift (#315 → #316 → #317).
Confirmed #315 has landed (`PermissionForwarder` + `InboxProcessor` exist, `requestApproval` already present but unused by production).
The plan injects the single forwarder into `PermissionPrompter` via a new narrow `ApprovalRequester` seam, deletes `buildForwardingDeps()` and its second `PermissionForwardingDeps` synthesis, and narrows `PermissionPrompterDeps` from 7 fields to 4.

### Observations

- Decided `ApprovalRequester` lives in `permission-forwarder.ts` next to `InboxProcessor`, mirroring the #315 seam convention — the prompter imports the type, never the concrete `PermissionForwarder` (design-review check 1/6 satisfied: no test casts, every remaining dep field is read).
- Identified one genuine behavioral nuance worth flagging, not an ambiguity: the deleted `buildForwardingDeps()` supplied a **no-op `writeDebugLog`** and `shouldAutoApprove: () => false`, whereas the shared forwarder carries the real `runtime.writeDebugLog` and yolo policy.
  `shouldAutoApprove` is inert on the `confirmPermission` path (never invoked there), but the real `writeDebugLog` means the subagent forwarding path now emits debug-level log lines it previously swallowed.
  Treated as the intended resolution of the "trace-level forwarding debug deferred" open question from #315, so no `ask_user` was needed — the issue's proposed change is otherwise unambiguous.
- Concluded the change is **one atomic TDD cycle**: narrowing `PermissionPrompterDeps` and removing `buildForwardingDeps()` break `index.ts` (excess properties) and the prompter test (missing `forwarder`) at the type level simultaneously, so production + `index.ts` wiring + test migration cannot be split.
  The test migration is mechanical (swap `mockConfirmPermission` module mock → injected `mockRequestApproval`, shift argument matchers by one position), not a logic rewrite, so the single-step constraint on large test files does not bite.
- Doc-update scope: `docs/architecture/permission-prompter.md` (deps interface, "Relationship to PermissionForwardingDeps" section, wiring) plus marking Phase 3 Step 3 `✅` in `architecture.md` — folded into a separate `docs:` commit following the #315 precedent.
- Commit types: cycle 1 is `refactor:` (behavior-preserving), cycle 2 is `docs:`.

## Stage: Implementation — TDD (2026-06-02T18:07:18Z)

### Session summary

Completed both TDD cycles in one session.
Cycle 1 swapped the prompter onto the injected `ApprovalRequester` seam: added the interface to `permission-forwarder.ts`, narrowed `PermissionPrompterDeps` from 7 to 4 fields, replaced the `confirmPermission(…, this.buildForwardingDeps(), …)` call with `this.deps.forwarder.requestApproval(…)`, deleted `buildForwardingDeps()` and all orphaned imports, rewired `index.ts` to construct the forwarder before the prompter, and migrated `permission-prompter.test.ts` from the polling module mock to an injected `mockRequestApproval`.
Cycle 2 updated `permission-prompter.md` (4-field deps, new "Relationship to the forwarder" section, wiring snippet) and marked Phase 3 Step 3 `✅` in `architecture.md`.
Test count: unchanged at 1756 (no net additions — the prompter suite is the same 21 tests, now with a simpler mock surface).

### Observations

- The two independent edits to `permission-prompter.ts` (imports + interface, and the `confirmPermission` call body) were applied in two separate `Edit` calls after the first batch unexpectedly required re-inspection — the first `Edit` call targeting three changes only applied the `buildForwardingDeps()` deletion, leaving imports and interface unchanged.
  Root cause: the autoformatter ran between tool calls and the stored file state diverged from what the first multi-edit expected.
  Resolution: re-read the file, applied the two remaining edits individually; no extra commits needed.
- Red phase verified: 15/21 tests failed after the test migration but before the production changes landed (polling module unmocked, `mockRequestApproval` never called by the old `confirmPermission` path).
- The argument-position shift (dropping the deps-bag positional argument) was mechanical and caught cleanly by test failures during the red phase — no stale matchers survived to green.
- `composition-root.test.ts` stayed green without modification: the forwarder-before-prompter reorder in `index.ts` did not perturb any wiring expectation.
- Pre-completion reviewer: **PASS** — all deterministic checks green, conventional commits verified, docs forward/reverse staleness clean, code design pass, 6 Mermaid diagrams parsed without errors.
