---
issue: 306
issue_title: "Evaluate commands inside command substitution and subshells against the permission rules"
---

# Retro: #306 — Evaluate nested bash commands (command substitution, process substitution, subshells)

## Stage: Planning (2026-06-02T00:33:17Z)

### Session summary

Planned #306 as a consumer of the #308 `BashCommand` model: extend `collectTopLevelCommandTexts` in `bash-program.ts` into a context-aware recursive enumerator that descends `command_substitution` (`$(…)`/backticks), `process_substitution` (`<(…)`/`>(…)`), and `subshell` (`( … )`), emitting each nested command as an additional `BashCommand` tagged with its execution `context`, in addition to the never-weaker whole emit.
Confirmed AST shapes with a throwaway `web-tree-sitter` probe and settled the one real design choice (the `context` field) with the owner before writing the plan.
Plan committed as a 3-step TDD sequence (enumeration descent → context tag + message surfacing → docs).

### Observations

- The owner chose to add the `context` field and surface it in the deny reason + ask prompt (`inside command substitution`), and to scope the tag to the **command-pattern** surface only — deferring per-command path/context provenance for the external-directory / bash-path surfaces to #307, which already introduces the per-command path model.
- `context` is added **with its consumers in a single commit** (step 2), not in step 1, because `pnpm fallow dead-code` flags a constructed-but-unread interface field (the exact trap the #308 retro called out for `context`/`name`/`argv`).
  Step 1 therefore keeps `BashCommand` one-field and lands the security fix (nested deny works as soon as the enumerator emits the inner units, since the handler already feeds `commands()` to the resolver).
- `context` is **optional and absent for top-level commands** (no `"top-level"` union member).
  This confines test churn: existing `commands()` and whole-`PermissionCheckResult` assertions stay green because `toEqual` treats an absent property as equal to `undefined`.
  Result-level `commandContext` is likewise only set for nested winners.
- The probe surfaced a non-obvious AST fact: when the **whole** command is a substitution (`$(a && b)` alone), `command_substitution` nests **under** `command_name`, not as a sibling argument — so the descent must search the entire `command` subtree, which `collectSubstitutionCommands` does.
- Robust delimiter skipping uses `node.isNamed` (a boolean property on `web-tree-sitter`'s node) rather than enumerating fragile anonymous token types (`$(`, `)`, `` ` ``, `(`, `<(`, …).
  This required adding `readonly isNamed: boolean` to the local `TSNode` interface.
- `BashCommandContext` is placed in `src/types.ts` (not the gate module) so `PermissionCheckResult` stays self-contained and the gate + presentation modules import it in the existing dependency direction.
- Design-review check on the shared-interface change: `PermissionCheckResult` gains one optional field read by two presentation modules and written by one resolver, riding the existing result-carries-context pattern (same as `command` / `matchedPattern`) — no new parameter threading, no LoD / output-argument smells.
- `configuration.md` documents the current limitation explicitly (nested contents "matched as part of their enclosing command rather than evaluated independently") — that prose and the "subshells … are not parsed" caveat are the required doc updates.
- Carried forward from #308: these are `feat:` commits (not `refactor:`), so #306 will appear in the changelog normally; no explicit-close caveat needed for release-please.

## Stage: Implementation — TDD (2026-06-02T00:54:01Z)

### Session summary

Implemented #306 across three TDD cycles (two `feat:` code commits + one `docs:` commit) exactly as planned: step 1 added the enumeration descent (the security fix), step 2 added the `context` field end-to-end with its message consumers in one commit, step 3 updated `configuration.md` + `architecture.md`.
Test count went 1704 → 1716 (+12: 8 enumeration tests in step 1, 4 context/message tests in step 2).
`pnpm run check`, `pnpm run lint`, `pnpm run test`, and `pnpm fallow dead-code` (repo root, 203 entry points) all green; no lockfile change.

### Observations

- No deviations from the plan — the file-by-file changes, the 3-step ordering, and the fallow-driven "field + consumer in one commit" split all held.
- The AST probe from planning paid off: `command_substitution` nesting **under** `command_name` (when the whole command is `$(…)`) is handled by `collectSubstitutionCommands` searching the full command subtree, and `node.isNamed` cleanly skips every delimiter/operator token without enumerating fragile anonymous type strings.
- Refined one planning detail during implementation: `NESTED_EXECUTION_CONTEXTS` became a `Map<string, BashCommandContext>` (node-type → context) instead of a `Set`, so `collectSubstitutionCommands` reads the context off the map rather than re-deriving it — decouples tree-sitter type strings from the union and avoids a cast.
- Step 2 threaded an optional `context` param through `collectCommandsInto` / `descendCommandChildren` and added a tiny `makeUnit(text, context)` helper so top-level units stay `{ text }` (no `context: undefined`), keeping the existing top-level `commands()` and whole-`PermissionCheckResult` assertions green under `toEqual`.
- One mechanical hiccup: an `Edit` to the `resolveBashCommandCheck` JSDoc failed because the `oldText` anchor started mid-line (`Matching the whole string…` is not a line start); re-anchored on the prior line and it applied.
  No rework.
- Pre-completion reviewer verdict: **PASS** (all deterministic checks green; code-design, docs forward/reverse, Mermaid, and dead-code all PASS; no acceptance-criteria list in the issue, so that check was SKIP).
  No warnings.
