---
issue: 580
issue_title: "pi-permission-system: shell-tool alias config model (shellTools)"
---

# Retro: #580 — Shell-tool alias config model (`shellTools`)

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Planned Phase 11 Step 2: an additive, non-breaking `shellTools` config field mapping a tool name to `{ commandField, workdirField? }`, delivering the validated/merged/documented config surface only (Step 3 / `#574` consumes it).
Produced a 3-cycle TDD plan — schema surface + regen, runtime carry-through + merge, docs + roadmap mark — committed as `0580-shell-tool-alias-config-model.md`.

### Observations

- **Merge semantics were the one real design choice** and are locked to **shallow-merge by tool name** (operator-confirmed after a walkthrough).
  Rationale: `shellTools` only ever *tightens* enforcement (routes a tool through the bash stack) and is inert when the tool is unregistered, so a dropped entry is a silent enforcement regression — additive merge is the safe, deterministic, least-privilege choice.
  Per-tool mapping override still works via key collision (spread replaces the colliding alias object wholesale); total codex opt-out is a package-disable concern, not a permission-config lever.
  "Replace wholesale" was rejected: its only added capability ("define one entry, silently drop all global entries") is a footgun with no legitimate use.
- **Grounded the design in the real tool** by cloning `@howaboua/pi-codex-conversion`: `exec_command` uses canonical fields `cmd` (required) + `workdir` (optional), confirming the issue's proposed `{ commandField: "cmd", workdirField: "workdir" }` shape and that a tool-name-keyed **map** is right (it also ships a code-mode `exec`; other extensions could register their own shells).
- **Kept `$defs` at three entries** by deliberately not `id`-tagging the alias sub-schema (it inlines), so the `config-schema.test.ts` `$defs` assertion stays green without edit.
- **Carry-through is compiler-enforced** post-`#356`: `normalizePermissionSystemConfig` reads the typed field, so a missed merge/normalize site fails `tsc` — the `#332`/`#347` silent-drop class is structurally guarded.
- **Release is deferred** (mid-batch, batch "shell-tool-aliases", tail = `#574`); the plan's commits (`feat:`/`docs:`) wait on `main` and auto-batch into the cut when Step 3 lands.
- Next step: `/tdd-plan` (this plan has test cycles).

## Stage: Implementation — TDD (2026-07-13T12:40:00Z)

### Session summary

Implemented all three planned TDD cycles: (1) `shellTools` schema surface + regenerated JSON schema, (2) runtime carry-through (`PermissionSystemExtensionConfig` + `normalizePermissionSystemConfig`) and shallow-by-tool-name merge in `mergeUnifiedConfigs`, (3) docs (`config.example.json`, `configuration.md`, `README.md`) + roadmap Step 2 marked `✅`.
Test count 2374 → 2387 (+13); `pnpm run check`, root `pnpm run lint`, and `pnpm fallow dead-code` all green.

### Observations

- **Tidy-First assessor found no preparatory work warranted** — every target file already had a direct precedent (`permissionMapSchema` for the new `z.record`, the `piInfrastructureReadPaths`/`toolInputPreviewMaxLength` copy-through blocks, the three-branch optional-field merge blocks, flat inline-literal test cases).
  Implemented directly.
- **Deviation from plan:** the plan listed exporting both `ShellToolAlias` and `ShellToolsConfig` from `config-schema.ts`; only `ShellToolsConfig` is exported (consumed by `extension-config.ts`).
  `ShellToolAlias` had no consumer yet and tripped the `fallow dead-code` gate, so it was dropped in a `refactor:` commit — `#574` reintroduces it when the enforcement gate consumes the field.
  Added one extra test beyond the plan (empty-string `commandField` rejection).
- **Design held as planned:** the un-`id`-tagged alias sub-schema inlines, keeping `$defs` at exactly three entries; regenerating the schema produces zero diff; `config.example.json` validates against `unifiedConfigSchema`.
- **Fallow gate caught the speculative export** — a reminder that `code-design`'s "no speculative re-exports" rule is enforced deterministically here, not just by review.
- **Pre-completion reviewer: PASS** — deterministic checks all green, no code-design concerns, Mermaid parses, dead-code clean, `#574` follow-up correctly recorded.
  No warnings.
- **Release:** mid-batch — defer (batch "shell-tool-aliases", tail = `#574`); confirm batching at ship time.
  Next step: `/ship-issue`.
