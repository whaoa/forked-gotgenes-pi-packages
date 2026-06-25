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
