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
