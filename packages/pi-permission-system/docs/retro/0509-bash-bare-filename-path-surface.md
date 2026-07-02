---
issue: 509
issue_title: "Bash bare-filename arguments bypass the path permission surface"
---

# Retro: #509 — Bash bare-filename arguments bypass the path permission surface

## Stage: Planning (2026-07-02T01:23:22Z)

### Session summary

Planned the rule-driven promotion fix for bash bare-filename arguments (`cat id_rsa`) bypassing the `path` permission surface.
Confirmed direction with the operator via `ask_user`: rule-driven promotion only (accept fail-safe false prompts for search patterns/branches), defer backslash-relative Windows tokens, and fold case on Windows.
Wrote a 6-step TDD plan and committed it; filed follow-up [#520] for the deferred backslash-relative concern.

### Observations

- The layering choice was the crux: rather than threading raw `path` patterns into the pure bash classifier, the plan has `PermissionManager` build a `PathRuleTokenMatcher` predicate (it already owns the composed ruleset and the injected `platform`), which is threaded manager → session → pipeline → `BashProgram.parse` → `BashPathResolver`.
  This keeps the Windows case/separator fold in one place and keeps the classifier pure (predicate passed in).
- Promotion must exclude the universal `"*"` pattern before evaluation — the gate's existing `matchedPattern === undefined` guard only skips the synthesized default, not a real `"*"` config rule, so a `"*"` path rule would otherwise storm every bash argument.
- Both interface widenings (`ScopedPermissionManager`, `ToolCallGateInputs`) break their fakes at the type level, so the plan folds each fake update into the same commit as its interface change (TDD steps 2 and 4).
- Promoted tokens reuse the unchanged `buildRuleCandidatePath`, so the `#393` unknown-base literal-only rule and `#418` canonical/lexical matching carry over for free — noted as invariants with pins.
- Not part of any release batch → ships independently.
- Docs to touch beyond `src`: `architecture.md` module-tree line, the package `SKILL.md` (which currently documents the bare-token exclusion as intentional), and `configuration.md` `path`-surface prose.

[#520]: https://github.com/gotgenes/pi-packages/issues/520
