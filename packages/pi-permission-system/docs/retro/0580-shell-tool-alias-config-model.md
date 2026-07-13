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
