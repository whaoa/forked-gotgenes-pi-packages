---
issue: 476
issue_title: "pi-permission-system: introduce the AccessPath value object (Phase 6 Step 4)"
---

# Retro: #476 — introduce the AccessPath value object (Phase 6 Step 4)

## Stage: Planning (2026-06-25T00:00:00Z)

### Session summary

Planned Phase 6 Step 4: a new `AccessPath` value object (`src/access-intent/access-path.ts`) holding a path's lexical and canonical forms behind `matchValues()` / `boundaryValue()` / `value()` accessors, making the [#418] match-vs-boundary conflation a compile error.
Both external-directory gates and `BashProgram.externalPaths()` route through it; `getExternalDirectoryPolicyValues` is folded into `matchValues()` and removed, while `canonicalNormalizePathForComparison` is retained as the shared boundary primitive.
Three TDD steps, behavior-preserving, release deferred to the batch tail (Step 5, [#477]).

### Observations

- **Two design forks resolved via `ask_user`** (operator's own roadmap issue): (1) **accessors-only** `AccessPath` (not a boundary-decision method) — confirmed as the representation to carry forward, with the gate/boundary consolidation deferred to Step 5; (2) **retain** `canonicalNormalizePathForComparison` as a shared primitive rather than force-removing it (it is still used by `isPathOutsideWorkingDirectory` on both path and cwd, so removal would drag boundary logic into Step 4 and overlap [#477]).
- **The issue's literal `BashProgram.externalPaths(cwd)` is stale** — Step 3 ([#475]) already made it the parameter-free `externalPaths()` getter (cwd supplied at `parse()`).
  The plan retypes the return element only (`string` → `AccessPath`), preserving the born-ready shape.
- **Win32 trap flagged** — the factory must recompute the canonical via `canonicalNormalizePathForComparison` (which lowercases on win32, [#382]), not reuse `cwd-projection.ts`'s raw `canonicalizePath` output (which skips lowercasing).
  Captured as an invariant + risk.
- **Dead-code / type-checker coupling drove the 2-code-step split**: `AccessPath` must land with its first consumer (single-tool gate) in step 1, and `getExternalDirectoryPolicyValues`'s removal must ride with its last consumer's migration (bash gate) in step 2 — both forced by `fallow dead-code` + `tsc`.
- **Test churn contained by lift-and-shift**: the ~90-assertion `bash-external-directory.test.ts` is left untouched by keeping the `extractExternalPathsFromBashCommand` facade's `string[]` contract (map `.value()`); only `program.test.ts` (~25 sites) adapts to `.value()`.
- **No follow-ups filed** — Steps 5–8 already exist as [#477]–#480; all deferred work maps to them.

[#382]: https://github.com/gotgenes/pi-packages/issues/382
[#418]: https://github.com/gotgenes/pi-packages/issues/418
[#475]: https://github.com/gotgenes/pi-packages/issues/475
[#477]: https://github.com/gotgenes/pi-packages/issues/477

## Stage: Implementation — TDD (2026-06-26T14:00:00Z)

### Session summary

All three TDD steps completed: introduced `AccessPath` value object and wired the single-tool gate (step 1); retypecd `BashProgram.externalPaths()` to `AccessPath[]`, routed the bash gate, and removed `getExternalDirectoryPolicyValues` in one atomic commit (step 2); updated `architecture.md` (step 3).
Test count rose from 2104 to 2111 (+7 net: 10 new `access-path.test.ts` tests minus the 3 migrated `getExternalDirectoryPolicyValues` cases).
Pre-completion reviewer returned **WARN** with two stale `architecture.md` entries; both fixed before writing this note.

### Observations

- **`pi-autoformat` reflowed `path-utils.test.ts`** after the describe-block removal, causing the orphaned `getExternalDirectoryPolicyValues` import to survive a first edit attempt — required a second targeted `Edit` to remove it after re-reading the file.
- **Atomic step 2 constraint held exactly as planned**: `tsc` coupling (`externalPaths(): string[]` → `AccessPath[]` cascade) and `fallow dead-code` coupling (`getExternalDirectoryPolicyValues` removal tied to its last consumer) forced all five production-file edits and four test-file adaptations into a single commit — no opportunity to split further.
- **WARN findings**: reviewer flagged two `architecture.md` stale references — (1) the `path-utils.ts` tree-listing still mentioned `getExternalDirectoryPolicyValues` after the step 3 docs commit; (2) the "Remaining design work" narrative described the `externalPaths(): string[]` conflation in present tense after it was resolved.
  Both fixed by amending the docs commit before writing this note.
- **Pre-completion reviewer verdict**: WARN (fixed inline — no unresolved findings at close).
