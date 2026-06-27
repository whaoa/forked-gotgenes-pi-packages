---
issue: 480
issue_title: "pi-permission-system: extract shared fixtures for the external-directory tests (Phase 6 Step 8)"
---

# Retro: #480 — Extract shared fixtures for the external-directory tests

## Stage: Planning (2026-06-26T00:00:00Z)

### Session summary

Planned the extraction of a shared `test/helpers/external-directory-fixtures.ts` for the external-directory handler-pipeline tests (Phase 6 Step 8).
Scoped the fixture to two files — `external-directory-integration.test.ts` and `external-directory-session-dedup.test.ts` — and explicitly excluded the third file the issue named.
The plan is a behavior-preserving `test:`-only refactor across two lift-and-shift commits plus a verification step, targeting package duplication ≤ 6.5% (currently 7.1%).

### Observations

- **File 3 (`test/bash-external-directory.test.ts`) dropped from scope** (operator decision via `ask_user`).
  It tests a different surface — the pure `extractExternalPathsFromBashCommand` function that runs *before* the gate, not the collapsed gate.
  Its bulk is the repeated system-under-test call, which the `testing` skill says not to wrap to chase a clone metric. fallow confirms it is not in the duplication families; its "880-line arrow" is a unit-size smell, not a clone family.
  No follow-up filed.
- **Discrepancy between issue and fallow:** the issue cites `test/bash-external-directory.test.ts`, but fallow's `bash-external-directory.test.ts` clone family is a *different* file under `test/handlers/gates/`.
  This reinforced that File 3's listed smell is size, not duplication.
- **The ~288 lines of clones in Files 1 & 2 alone hit the ≤ 6.5% target** — so excluding File 3 does not jeopardize the roadmap outcome.
- **No-speculative-export constraint shaped the TDD order:** each migration commit lands the fixture pieces *and* their sole consumer together, so no fixture-only commit leaves dead exports for fallow to flag.
- **Invariant guard:** the dedup `check(intent)` mock (`makeExtDirDedupCheck`) must preserve `intent.kind === "path-values"` dispatch ([#478] / [#418]) or external-directory false-greens to `allow`; moved verbatim, and the re-prompt assertions catch a regression.
- **Release nuance:** roadmap tag is `Release: independent`, but a `test:`-only change is `hidden: true` and will not cut a release on its own — it auto-batches into the next release.
  Recorded in the plan's Release Recommendation rationale.

[#418]: https://github.com/gotgenes/pi-packages/issues/418
[#478]: https://github.com/gotgenes/pi-packages/issues/478

## Stage: Implementation — TDD (2026-06-26T21:30:00Z)

### Session summary

Completed all three TDD steps in a single session across two lift-and-shift commits.
Created `test/helpers/external-directory-fixtures.ts` and migrated both handler-pipeline test files onto it, dissolving the 43-line wiring duplicate in the session-dedup file's inline shutdown test.
Package duplication dropped from 7.1% to exactly 6.5% — the roadmap Step 8 target.

### Observations

- **Duplication hit exactly 6.5%** — the two major clone families (21 groups/214 lines and 3 groups/74 lines) no longer appear as top-level families in `pnpm fallow dupes`.
  Residual clones (17 groups/133 lines in the integration file; 2 groups/14 lines in the dedup file) are the test-act repetitions the `testing` skill says not to wrap.
- **`pi-autoformat` converted `makeEvents` to `type makeEvents`** in the first fixture write (correctly: only used in a type position at that point).
  Adding `makeDedupWiring` in Step 2 reintroduced a value-position use of `makeEvents`, so the import had to be changed back to a value import.
  The `Edit` approach for the Step 2 update handled this cleanly in the imports edit.
- **`makeSessionApprovingPrompter` kept private** — not exported, since File 2 never uses it directly; `makeDedupWiring` builds the default prompter internally.
  This avoids a fallow dead-export flag while keeping the approval semantics encapsulated.
- **Event-shape preservation** — File 2 uses `toolName:` (not `name:`) in event literals; the new `makeExtDirToolEvent` / `makeExtDirBashEvent` builders match that shape exactly so `getToolNameFromValue` behavior is unchanged.
- **Pre-completion reviewer verdict: WARN** (non-blocking).
  All WARN items are `architecture.md` roadmap markers (`✅` on Step 7 + Step 8 headings and Mermaid nodes, Track C flip to `✅ complete`, Step 8 `Target:` description update to remove the scoped-out `bash-external-directory.test.ts`) — all explicitly deferred to ship time per the plan.
