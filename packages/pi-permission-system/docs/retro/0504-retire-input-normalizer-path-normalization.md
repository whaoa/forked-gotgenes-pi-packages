---
issue: 504
issue_title: "pi-permission-system: retire input-normalizer path normalization (Phase 7 Step 3)"
---

# Retro: #504 — Retire input-normalizer path normalization (Phase 7 Step 3)

## Stage: Planning (2026-06-29T18:30:00Z)

### Session summary

Planned Phase 7 Step 3 (batch "symlink-resistant-path-matching" tail): remove the dead lexical-only path normalization from `input-normalizer.ts` left behind by Steps 1 ([#502]) and 2 ([#503]).
Verified against live code that `normalizePathSurfaceValues`, the special-surface (`path` / `external_directory`) branch, and the `PATH_BEARING_TOOLS` branch of `normalizeInput` have no remaining production caller for a real path value — every path surface now routes through `access-path` → resolver → `path-values`.
Produced a four-step plan (two `test:` steps, one `refactor:`, one `docs:`) at `docs/plans/0504-retire-input-normalizer-path-normalization.md`.

### Observations

- **The change is non-breaking despite riding a breaking batch.**
  The tail commit is a pure `refactor:` (dead-code removal); the missing-path / empty-input case for path-bearing tools falls through to the generic `["*"]` branch with an identical result.
  The release is cut by Steps 1 and 2's already-landed breaking `feat!:` commits, not this refactor — so the `Release Recommendation` is "ship now — batch tail" with a rationale that the refactor itself does not trigger a release (Refs #479).
- **The bulk of the work is a faithful test migration, not the production removal.**
  `test/permission-manager-unified.test.ts` has ~30 `checkTool(manager, <path-surface>, { path })` calls that rely on the doomed `normalizeInput` path branches; they migrate to a new `checkPath` helper routing through the `path-values` intent via `getPathPolicyValues(path, opts, "linux")` — identical values, green against current production (tidy-first preparatory Step 1).
  The ~39 empty-input `checkTool(manager, <surface>, {})` calls produce `["*"]` and are unaffected.
- **Confirmed the migration surface is confined to one test file.**
  All other `kind: "tool"` test usages (`permission-resolver.test.ts`, `permission-event-rpc.test.ts`, `service.test.ts`, `skill-prompt-sanitizer.test.ts`) use `bash`/`skill` surfaces; only `permission-manager-unified.test.ts` drives `tool` intents for path surfaces.
- **`currentCwd` removal is forced by the dead-code gate.**
  Grep confirmed `permission-manager.ts`'s `currentCwd` field is read only by the `normalizeInput` call being changed; `configureForCwd` rebuilds the loader from its `cwd` parameter directly.
  Dropping the field (and the `platform`/`cwd` params from `normalizeInput`) avoids a `pnpm fallow dead-code` failure — the [#502] lesson that the baseline check/lint/test triad does not see dead members or stale suppressions.
- **Signature change cascades to test arity.**
  Dropping `platform`/`cwd` from `normalizeInput` breaks every `normalizeInput(..., "linux")` call at `tsc` time (esbuild skips it), so the arity fix rides in the `refactor:` green commit, with `pnpm run check` immediately after.
- **Doc rewrite needed, not just a `✅`.**
  `architecture.md`'s `### Path-bearing tool normalization` section still attributes per-tool path matching to `normalizeInput`; it must be reworded to the `access-path` mechanism ([#502]) — reworded prose carries no removed symbol, so it would not surface in a `src/`-symbol grep.
  Also flagged SKILL.md line ~130's deferred-follow-up note that names `normalizeInput` as the threading mechanism.
- **Skipped the `ask_user` gate:** operator-authored issue, unambiguous and roadmap-blessed proposal, consistent with the [#502] / [#503] precedent in this batch.

[#502]: https://github.com/gotgenes/pi-packages/issues/502
[#503]: https://github.com/gotgenes/pi-packages/issues/503
