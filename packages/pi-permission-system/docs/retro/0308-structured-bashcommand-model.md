---
issue: 308
issue_title: "Introduce a structured BashCommand model and parse the bash command once per tool_call"
---

# Retro: #308 — Structured BashCommand model and parse-once injection

## Stage: Planning (2026-06-01T00:00:00Z)

### Session summary

Issue #308 was created during what began as the `/plan-issue 306` session, after the owner asked "what architecture or system design changes would make #306 easier?"
and chose to pay the foundation upfront.
The friction analysis surfaced that the three bash gates each parse the command independently (three parses per `tool_call`) and apply three subtly different AST descent policies, and that the command-pattern unit is a flat `string[]` re-derived per feature — the divergence that produced the #301-class bug.
This issue captures the behavior-preserving enabler (a `BashCommand` model for the command-pattern slice plus a single shared parse injected into the gates); #306 (nested-context descent) and #307 (effective-cwd projection) become consumers, mirroring the #304 → #301 split.

### Observations

- Scope was deliberately trimmed from the issue's first draft.
  The original #308 body claimed "path candidates, external paths, and command-pattern units all derive from `commands()`."
  Planning showed that is not behavior-preserving in one step: `pathTokens()`/`externalPaths()` walk the **whole** tree (incl. substitution/subshell interiors), whereas `topLevelCommands()` emits compound statements (`subshell`, `compound_statement`) **whole** and descends only `program`/`list`/`pipeline`/`redirected_statement`.
  A flat `commands()` cannot serve both at the right depth.
  So #308 models only the command-pattern slice; the path/external slices stay as methods on the shared parse and converge per-command in #307 (which needs it anyway).
  The #308 issue body was corrected to match.
- `BashCommand` is intentionally a one-field type (`text`).
  Adding `context`/`name`/`argv`/`pathCandidates`/`effectiveCwd` now would be a fallow-flagged dead field; each is added by its consuming issue (#306 adds `context`, #307 adds the path/cwd fields).
  The value of introducing the object now is the stable extension seam — #306/#307 add fields rather than migrate a `string[]` return type.
- The 1027-line `test/bash-external-directory.test.ts` exercises the `extractTokensForPathRules` / `extractExternalPathsFromBashCommand` facades directly (~90 call sites). #304 kept those facades for exactly this suite (lift-and-shift).
  So #308 keeps them and switches only the **production gates** to the injected `BashProgram`; the facades become a test-only seam (fallow treats tests as consumers, so they stay live).
  Fully retiring them is a deferred cleanup.
- AST shapes were verified with a throwaway `web-tree-sitter` probe before writing assertions: `command_substitution` wraps `$(…)` and backticks; `process_substitution` wraps `<(…)`/`>(…)`; `subshell` wraps `( … )`; `file_redirect` is a **sibling** of the command inside `redirected_statement` (redirect targets attach to that command); `compound_statement` is the `{ … }` brace group, which runs in the current shell (relevant to #307's `cd`-scoping, not #308).
- `resolveBashCommandCheck` is reshaped from "parse internally via an injectable `decompose`" to "combine a caller-supplied `units` list," moving decomposition into the handler so it flows from the single shared parse.
  The `?? checkPermission(command)` empty-units fallback is preserved (never-weaker).
- New `BashProgram.commands()` needs the `// fallow-ignore-next-line unused-class-member` suppression (singular kind, no trailing prose) — the private-ctor + static-factory false positive documented in the #304 retro.
- Sibling issues filed this session: #307 (project a running effective working directory across `cd`s onto path candidates) and #309 (unify the advisory `checkPermission`/RPC bash path with the gate's decomposed fidelity — deferred because it needs a warm parser and changes public sync-API semantics; it is advisory-path polish, not an enforcement gap, since the gate is already decomposed).
- Ship-time warning carried forward from the #301 retro: this is a `refactor:`-heavy enabler; if it ships stacked under #306, release-please omits it from the changelog, so #308 must be closed explicitly.

### Diagnostic details

- **Feedback-loop gap analysis** — Steps 1–3 are each paired with `pnpm run check` in the plan because they are behavior-preserving signature changes the type checker catches before the suite; step 3 additionally runs the full suite because `resolveBashCommandCheck` is a shared helper.
- **Escalation-delay tracking** — The "single flat `commands()` for all slices" design was abandoned once the `compound_statement`/`subshell` whole-emit parity issue surfaced during AST verification, before any plan text committed to it.
