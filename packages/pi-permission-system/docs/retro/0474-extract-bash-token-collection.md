---
issue: 474
issue_title: "pi-permission-system: extract bash token collection from bash-program.ts (Phase 6 Step 2)"
---

# Retro: #474 — Extract bash token collection from `bash-program.ts`

## Stage: Planning (2026-06-25T17:30:00Z)

### Session summary

Produced a three-cycle plan for Phase 6 Step 2: extract the pattern-first command table, flag classifier, and token collectors (`collectPatternCommandTokens`, `collectGenericCommandTokens`, `collectRedirectTokens`, `collectCommandTokens`, `collectPathCandidateTokens`) into `src/access-intent/bash/token-collection.ts`, a behavior-preserving lift-and-shift.
The plan resolves the issue's main gap — two symbols the collectors share with code that stays behind (`extractCommandName`, `ARG_NODE_TYPES`) — by splitting them across two homes on a layering argument.

### Observations

- The issue's symbol list is incomplete: `extractCommandName` and `ARG_NODE_TYPES` are used by both the moving collectors and the staying cwd-projection (`foldCd`/`cdLiteralTarget`), so they can't remain in `bash-program.ts` (that would create a `token-collection` ↔ `bash-program` import cycle).
- Resolved via `ask_user` (operator's own issue, so the gate confirmed direction on a genuine design ambiguity): `ARG_NODE_TYPES` → `node-text.ts` (tree-sitter grammar mechanics, peer of `SKIP_SUBTREE_TYPES`); `extractCommandName` → `token-collection.ts` (a bash-domain command-identity query), **name kept**.
- The operator's steer was the key insight: `extractCommandName` answers a bash-program question, not a tree-sitter-node question — so a `resolve*` rename (to mirror `resolveNodeText`) would falsely advertise it as a generic AST primitive and pull it to the wrong layer.
  The split is justified by layer, and it adds no new module dependency edge (cwd-projection already depends on both `token-collection.ts` and `node-text.ts`).
- Grep across `src/`, `test/`, and `SKILL.md` confirmed no external consumer references any moved symbol — collectors are exercised only through `BashProgram`'s public slices.
  SKILL needs no edit.
- Step 1 ([#473]) has already landed on `main` (its code is present: `parser.ts`/`node-text.ts` exist, `bash-program.ts` is 1,045 LOC), so #474's blocker is satisfied; the issue's line numbers (334–687) predate Step 1's extraction and were recomputed against the current file.
- Three collectors must be **exported** (consumed by the staying walk); the rest stay private — exporting more would draw a fallow dead-code flag.
- LOC honesty: removing ~355 lines lands `bash-program.ts` at ~690 LOC, slightly above the roadmap's "≤ 670" estimate; the remainder clears in Step 3.
  Flagged for the retro, not treated as a blocker for a behavior-preserving move.
- Release marker: mid-batch — defer (batch "bash-program-decomposition", tail = Step 3 [#475]); all-`refactor:` batch produces no release until Step 3 carries a bumping commit.

[#473]: https://github.com/gotgenes/pi-packages/issues/473
[#475]: https://github.com/gotgenes/pi-packages/issues/475

## Stage: Implementation — TDD (2026-06-25T12:45:00Z)

### Session summary

Completed all three planned TDD cycles: moved `ARG_NODE_TYPES` to `node-text.ts` (Cycle 1), extracted the token collectors and `extractCommandName` into `src/access-intent/bash/token-collection.ts` with 21 new unit tests (Cycle 2), and updated `docs/architecture/architecture.md` with the layout entry, `✅` Step 2 marker, and layering note (Cycle 3).
`bash-program.ts` dropped from 1,045 → 695 LOC; test count rose from 2,086 (100 files) to 2,107 (101 files).

### Observations

- Cycle 1 used an atomic two-entry `Edit` call (add `ARG_NODE_TYPES` to `node-text.ts`, delete local definition from `bash-program.ts`) — Biome `noRedeclare`/`noUnusedImports` acted as the correctness gate.
- Cycle 2 import edit + block removal required two operations: `Edit` for the import block, then `sed -i '' '240,587d'` for the 348-line body removal (the plan's AGENTS.md guidance to anchor on adjacent unique code lines rather than decorative rules applies; the block was too large for a single `Edit` `oldText` without spanning many decorative headers).
  Re-read confirmed no enclosing brace was removed.
- Test expectation gap: `extractCommandName` called with `$(which sed)` as command name returns `"$(which sed)"` (not `undefined`) because `resolveNodeText` on a `command_name` node falls through to the default case and returns the node's text.
  The test was corrected to document the actual behaviour; `PATTERN_FIRST_COMMANDS.get("$(which sed)")` returns `undefined` anyway, so the fall-through to generic collection is still exercised.
- LOC actual: 695 (plan estimated ~690; roadmap's "≤ 670" was a pre-Step-1 estimate; remainder clears at Step 3).
  The architecture doc outcome line still reads "drops below ~670 LOC" — reviewer WARN, non-blocking, left for Step 3's doc pass.
- Test file path deviation: plan named `test/token-collection.test.ts` but actual placement is `test/access-intent/bash/token-collection.test.ts` (mirrors the `src/access-intent/bash/` structure and is consistent with Step 1's placement of `node-text.test.ts`); reviewer WARN, non-blocking.
- Pre-completion reviewer: PASS (2 non-blocking WARNs above).
