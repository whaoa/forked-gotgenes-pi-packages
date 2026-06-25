---
issue: 473
issue_title: "pi-permission-system: extract the tree-sitter parser and AST node-text resolver from bash-program.ts (Phase 6 Step 1)"
---

# Retro: #473 — Extract the tree-sitter parser and AST node-text resolver from `bash-program.ts`

## Stage: Planning (2026-06-25T00:00:00Z)

### Session summary

Produced a three-cycle plan for Phase 6 Step 1: lift the lazy tree-sitter parser (`getParser`, `TSNode`, `TSParser`, `initParser`) into `src/access-intent/bash/parser.ts` and the quote-aware node-text resolver (`resolveNodeText`, `SKIP_SUBTREE_TYPES`) into `src/access-intent/bash/node-text.ts`, leaving `bash-program.ts` importing both.
Pure lift-and-shift, non-breaking; the plan seeds the package's first domain directory and adds the unit tests the extraction newly enables.

### Observations

- Verified the extraction is legitimate SRP decomposition, not metric-gaming procedure-splitting: the parser **owns state** (memoized singleton + retry semantics) and `resolveNodeText` **returns a value** (pure AST transform), both leaf utilities with zero dependency on the rest of the file.
- `TSNode` must be **exported** from `parser.ts` (used pervasively in `bash-program.ts` and by `node-text.ts`); `TSParser` and `initParser` stay **private** to avoid a fallow dead-code flag for an export with no importer.
- `SKIP_SUBTREE_TYPES` is not used by `resolveNodeText` itself — it is consumed by walkers that stay in `bash-program.ts` — but per the issue it moves into `node-text.ts` and is imported back.
- `createRequire` (`node:module`) and `memoizeAsyncWithRetry` (`#src/async-cache`) are used only by the parser block (grep-verified), so both imports become dead in `bash-program.ts` after Cycle 1 and must be removed in the same commit.
- Testability win: neither new module imports `#src/canonicalize-path`, so their unit tests skip the canonicalize mock that any test transitively importing `bash-program.ts` needs (retro 0345).
- Doc/skill staleness enumerated: `docs/architecture/architecture.md` layout tree + `async-cache.ts` line, and `.pi/skills/package-pi-permission-system/SKILL.md` jiti note all name the parser's old home and need updating (Cycle 3).
- Commit type is `refactor:` (behavior-preserving).
  Flagged for the Step 3 ship decision: `refactor` is `hidden`/non-bumping under `release-please-config.json`, so the all-`refactor:` batch "bash-program-decomposition" produces no release unless Step 3 carries a `feat:`/`fix:` commit.
- Release marker: mid-batch — defer (batch "bash-program-decomposition", tail = Step 3 [#475]).
- Skipped the `ask-user` gate: operator's own issue, unambiguous proposal with exact line targets and target paths.
