---
issue: 502
issue_title: "pi-permission-system: migrate the per-tool path-bearing gate onto AccessPath (Phase 7 Step 1)"
---

# Retro: #502 — Migrate the per-tool path-bearing gate onto AccessPath (Phase 7 Step 1)

## Stage: Planning (2026-06-29T00:00:00Z)

### Session summary

Planned Phase 7 Step 1: route the per-tool path-bearing gate (`read`/`write`/`edit`/`grep`/`find`/`ls`) onto `AccessPath` so per-tool rules match lexical ∪ canonical, closing the symlink-evasion asymmetry against the `path` surface.
The change is mechanically parallel to [#486] (the `path`-surface migration): the resolver already unwraps `access-path` → `path-values` and `PATH_SURFACES` already routes the per-tool surfaces through `evaluateAnyValue`, so the only behavior change is the canonical alias joining the match set.
Produced a three-step plan (breaking `feat!:` behavior change, a `refactor:` accessor removal, then docs) at `docs/plans/0502-per-tool-gate-access-path.md`.

### Observations

- **`getPlatform()` removal is forced, not optional, and resolves [#513].**
  [#511] is already merged, so [#502] is the *second* of the two `getPlatform()` consumers to fold.
  Once the per-tool gate stops reading `platform` (it threaded it only to feed `deriveSuggestionValue`'s `normalizePathForComparison`), the pipeline's `getPlatform()` read is dead and the accessor would trip the `pnpm fallow dead-code` CI gate.
  So Step 2 removes `getPlatform()` from `ToolCallGateInputs` + `PermissionSession` + `makeGateInputs`, and [#513] should be closed at ship with a pointer to the [#502] SHA.
- **Scope discriminator:** keyed the `access-path` branch off `getPathBearingToolPath(...) !== null` (built-in six with a present `input.path`).
  This deliberately keeps the missing-path case on the `tool` intent so the `normalizeInput` `["*"]` fallback is preserved, and keeps MCP/extension tools on `tool` (their path is already symlink-resistant via the cross-cutting `path` gate since [#486]).
- **Suggestion value is provably unchanged:** `accessPath.value()` equals the old `normalizePathForComparison(path, tcc.cwd, platform)` because the pipeline normalizer is built from the same session `cwd` + `platform`.
  Flagged the two [#438] cwd-bounding tests as the invariants to keep green (now passing an injected `AccessPath` built via `new PathNormalizer(...)`).
- **Structural win:** the change removes a parameter relay — `platform` threaded session → pipeline → `describeToolGate` solely to feed one derivation the `AccessPath` the gate already builds now owns (Tell-Don't-Ask via `value()`).
- **Release:** Step 1 of batch "symlink-resistant-path-matching" (tail = Step 3, [#504]); mid-batch → defer.
  The breaking `feat!:` lands on `main` and auto-batches; the major-bump release cuts when Step 3 lands.
- Skipped the `ask_user` gate: operator-authored issue, unambiguous proposal, and the only scope addition (`getPlatform()` removal) is forced by the dead-code gate + [#513], not a genuine design choice.
