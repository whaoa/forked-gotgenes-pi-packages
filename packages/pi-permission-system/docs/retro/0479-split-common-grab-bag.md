---
issue: 479
issue_title: "pi-permission-system: split the common.ts grab-bag (Phase 6 Step 7)"
---

# Retro: #479 — pi-permission-system: split the `common.ts` grab-bag (Phase 6 Step 7)

## Stage: Planning (2026-06-26T23:45:17Z)

### Session summary

Planned Phase 6 Step 7: split the `common.ts` grab-bag (fallow's only refactoring target, 22 dependents) into `src/value-guards.ts` (six runtime type guards) and `src/yaml-frontmatter.ts` (two YAML/frontmatter parsers).
The plan is a single atomic `refactor:` commit — pure lift-and-shift, no behavior change — landed in `packages/pi-permission-system/docs/plans/0479-split-common-grab-bag.md`.

### Observations

- Non-breaking: `common.ts` is internal-only (not re-exported from `index.ts` or `package.json` `exports`), so the split has no external surface.
- The two concerns are fully independent (no cross-calls, no shared internal helper), so the partition is clean; only `policy-loader.ts` imports from both new modules.
- Verified dependent counts by grep: 17 value-guards-only `src/` importers, 1 dual importer (`policy-loader.ts`), 1 more (`config-loader.ts`) that looked dual but is value-guards-only; 3 test files.
- Chose a single atomic commit (no transitional re-export shim) per the AGENTS.md export-removal rule and to avoid the barrel-sprawl smell the architecture doc flags — `tsc` keeps the repoint honest.
- `Release: independent` per the architecture roadmap's "Release batches" subsection (Steps 6, 7, 8 are independently releasable); confirmed `refactor:` commits trigger a patch release in this repo's release-please config (e.g. #477 released on a refactor-only commit).
- Deferred to ship time (per package SKILL convention): the Step 7 `✅` completion marker, the `S7` Mermaid node marker, and the `common.ts` health-metric row; the module-tree listing update rides with the refactor commit since it is a layout fact, not a completion marker.
- Skipped the `ask-user` gate (issue authored by the operator, proposed change unambiguous) and the `design-review` checklist (no shared-interface or layer-wiring change — only free-function relocation and import repoints).
