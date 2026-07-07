---
issue: 532
issue_title: "pi-permission-system: split value-guards.ts by cohesion"
---

# Retro: #532 — pi-permission-system: split value-guards.ts by cohesion

## Stage: Planning (2026-07-07T00:00:00Z)

### Session summary

Planned Phase 8 Step 8: split `value-guards.ts` by cohesion, keeping the generic parsing guards (`toRecord`, `getNonEmptyString`) and moving the domain guards (`isPermissionState`, `isDenyWithReason`) to `types.ts` beside the `PermissionState` / `DenyWithReason` types they narrow.
The plan is a single atomic `refactor:` step (extraction + three `src/` consumer repoints + test move) plus a doc-update step, releasing independently.

### Observations

- The issue's "Proposed change" lists `normalizeOptionalStringArray` and `normalizeOptionalPositiveInt` among the generic guards to keep, but [#547] already removed both (commit `146844aa`) when zod took over config validation.
  The surviving generic set is only `toRecord` + `getNonEmptyString`; `value-guards.ts` is now 38 LOC, not the 56 the issue cites.
  The roadmap step note already records this shrink.
- Domain-guard consumers are exactly three `src/` files (`permission-manager.ts`, `normalize.ts`, `config-loader.ts`) plus `test/value-guards.test.ts`.
  All three already import types from `./types`, so the repoint merges into an existing import source.
- The `no-restricted-imports` ESLint rule on `permission-manager.ts` blocks only `access-intent/access-path`, so importing a guard from `./types` is allowed.
- Removing the two exports from `value-guards.ts` breaks every importer at the type level in the same commit, so extraction + consumer updates + test moves are one atomic step — mirrors [#479]'s single-step `common.ts` split.
- `types.ts` transitions from types-only to types-plus-guards; judged a natural co-location (a guard is the runtime companion of its type) and endorsed by the roadmap, so no `ask_user` gate was needed.
- Doc updates confined to the live `architecture.md` (module-tree lines, Step 8 ✅ marker + Mermaid node, fallow health row 1 → 0); all other doc hits are historical records (`docs/plans`, `docs/retro`, `docs/decisions`, `history/`) that must not be edited.
- Risk flagged: if `fallow` does not clear `value-guards.ts` to 0 targets (its fan-in is on the retained generic guards), record the actual count rather than forcing the health-row edit — the mixed-cohesion smell, not fan-in, is what this step targets.

[#479]: https://github.com/gotgenes/pi-packages/issues/479
[#547]: https://github.com/gotgenes/pi-packages/issues/547
