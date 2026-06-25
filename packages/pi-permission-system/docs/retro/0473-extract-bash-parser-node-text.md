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

## Stage: Implementation — TDD (2026-06-25T11:23:00Z)

### Session summary

Completed all three planned TDD cycles: extracted the tree-sitter parser block to `src/access-intent/bash/parser.ts` (Cycle 1), extracted the node-text resolver and `SKIP_SUBTREE_TYPES` to `src/access-intent/bash/node-text.ts` (Cycle 2), and updated `docs/architecture/architecture.md` plus `.pi/skills/package-pi-permission-system/SKILL.md` (Cycle 3).
`bash-program.ts` dropped from 1,143 → 1,045 LOC; test count rose from 2,069 (98 files) to 2,086 (100 files) with 17 new tests across 2 new files.

### Observations

- Cycle 1 removed the `createRequire` and `memoizeAsyncWithRetry` imports from `bash-program.ts` in the same commit — confirmed dead by prior grep; the autoformatter's `noUnusedImports` check validated the removal immediately.
- The import-then-delete order (add new import, autoformat fires `noRedeclare`, then remove old definitions) was the correct two-step sequence given how `pi-autoformat` runs after each edit; the intermediate lint error from `noRedeclare` resolved cleanly once the old block was removed.
- Autoformatter reordered the new imports in `bash-program.ts` alphabetically (`node-text` before `parser`), which is fine — both use the `#src/access-intent/bash/` alias.
- `SKIP_SUBTREE_TYPES` in `node-text.ts` was reformatted from a single-line `new Set([...])` to a multi-line form by the autoformatter; content preserved, no behavior change.
- Pre-completion reviewer: WARN (non-blocking).
  - Reviewer warnings: (1) Mermaid diagram node `S1` was missing `✅` — the heading carried it but AGENTS.md requires both; fixed by amending the docs commit; (2) `node-text.test.ts` had two Biome `noTemplateCurlyInString` warnings for the intentional literal `"${VAR}"` strings — fixed with a `biome-ignore` comment; both resolved before writing stage notes.
- `bash-program.ts` LOC fell 98 lines (1,143 → 1,045), slightly more than the plan's ~120 projection because the decorative `// ── AST walker ──` section header was also removed when the walker block emptied.
- No deviations from the plan's Module-Level Changes list.
