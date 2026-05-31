---
issue: 286
issue_title: "Decompose resolvePermissions in permission-manager.ts"
---

# Retro: #286 — Decompose `resolvePermissions` in `permission-manager.ts`

## Stage: Planning (2026-05-31T04:36:52Z)

### Session summary

Planned the Phase 2 step 2 decomposition of `PermissionManager.resolvePermissions`.
The plan extracts `mergeScopesWithOrigins(scopes)` (returning `{ mergedPermission, origins }`) into a new `src/scope-merge.ts` module with a sibling `test/scope-merge.test.ts`, leaving the remaining method as a linear pipeline.
Behavior-preserving: `permission-manager-unified.test.ts` stays green unmodified.

### Observations

- One genuine design decision surfaced via `ask_user`: where the extracted function lives.
  Options were a new module, folding into `permission-merge.ts`, or an exported in-file helper (the [#285] precedent).
  User chose the new `scope-merge.ts` module — matches the package's dominant one-concern-per-file convention and keeps `permission-merge.ts` purely about config-shape merge.
- Caught a non-obvious cleanup: after extraction, `permission-manager.ts` no longer calls `mergeFlatPermissions` directly (it was the sole call site there), so its import must be removed in the same step — `pnpm check` will catch a stray reference.
- The `OriginMap` type alias moves into `scope-merge.ts` and stays unexported (the consumer reads `origins` via the inferred `MergedScopes` return type); `MergedScopes` is exported and the new test imports it so fallow does not flag a dead export.
- TDD order follows the accepted [#285] pattern: step 1 commits a red test (module not yet created), step 2 creates the module + rewires the sole call site in one commit, step 3 updates `architecture.md` after re-running `fallow health --targets` to record new numbers.
- The attribution branch (shallow-merge vs. full-replacement, including the `eslint-disable @typescript-eslint/no-unnecessary-condition` comments) moves verbatim — the densest, highest-risk part — so behavior is preserved by construction.

## Stage: Implementation — TDD (2026-05-31T04:52:42Z)

### Session summary

Completed all three TDD cycles: wrote `test/scope-merge.test.ts` (9 tests, red), created `src/scope-merge.ts` and rewired `resolvePermissions` (green, +1553 total passing vs. 1544 baseline), then updated `docs/architecture/architecture.md` (module-tree entry, health metrics, step 2 marked ✅).
All deterministic checks pass (check, lint, test, fallow dead-code).
Pre-completion reviewer returned PASS.

### Observations

- The first `Edit` on `permission-manager.ts` accidentally prepended duplicate import blocks (the `oldText` matched only the first line of the original import section rather than the whole block).
  Recovered by reading the corrupted file and rewriting the entire import section with a second `Edit` covering the full duplicated range.
  Lesson: when replacing a multi-line import block, use the entire block (including closing `} from "..."`) as `oldText`, not just the opening line.
- The `fallow health --targets` output confirms `resolvePermissions` is no longer in the refactoring-targets list; `permission-manager.ts` is gone from the CRAP-risk note; the four remaining targets are `tool-input-preview.ts`, `config-loader.ts` (stripJsonComments / Phase 2 step 5), `runner.ts` (runGateCheck / step 3), and `bash-path-extractor.ts` (step 4).
- `MergedScopes` is imported by the test file (typed as the result of `mergeScopesWithOrigins([])` in the first test case), satisfying fallow's dead-export check.
- Pre-completion reviewer: PASS — no warnings.
