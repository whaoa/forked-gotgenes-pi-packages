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

## Stage: Implementation — TDD (2026-07-02T22:14:00Z)

### Session summary

Executed all 6 TDD steps exactly as planned: pure `classifyPromotedRuleCandidate` classifier, `PermissionManager.getPromotablePathTokenMatcher`, `BashPathResolver`/`BashProgram.parse` promotion wiring, `ToolCallGatePipeline` matcher threading, an end-to-end composition-root repro of the issue's literal cases, and docs.
Test count grew from 2207 to 2233 (26 new tests) in `pi-permission-system`; full monorepo suite, `tsc --noEmit`, root lint, and `pnpm fallow dead-code` all green throughout.
Pre-completion reviewer verdict: **PASS**.

### Observations

- Two small deviations from the plan's exact Module-Level Changes list, both sensible and noted to the reviewer:
  1. `src/rule.ts`'s private `pathMatchOptions` had to be exported so `PermissionManager.getPromotablePathTokenMatcher` reuses the exact Windows case/separator fold `evaluate()` uses, instead of re-deriving it — the plan's Design Overview already implied this ("The Windows fold mirrors `pathMatchOptions`") but didn't list `rule.ts` as a changed file.
  2. `test/permission-resolver.test.ts` has its own inline fake `ScopedPermissionManager` (separate from `test/helpers/session-fixtures.ts`'s `makeFakePermissionManager`) that also needed the new `getPromotablePathTokenMatcher` stub — the plan anticipated only the shared fixture needing the update.
- The Step 4 pipeline test (`ToolCallGatePipeline` threading) required updating one pre-existing assertion (`toHaveBeenCalledWith("echo hello", expect.any(PathNormalizer))` → add `expect.any(Function)` for the third arg) since `vi.fn().toHaveBeenCalledWith` checks the full argument list — a straightforward, anticipated-by-the-testing-skill breakage from adding an optional parameter that the pipeline now always supplies.
- Step 5 (the end-to-end composition-root test) passed immediately on first run with no red phase — by design, since the plan sequenced it after all four implementation steps landed; it served as a confirmation/documentation commit rather than a traditional red→green cycle, matching the plan's framing.
- The `getPromotablePathTokenMatcher` unit tests needed an explicit `platform: "win32"`/`"linux"` injected `PermissionManager` (not the `makeInMemoryManager` helper, which doesn't expose a platform override) to pin the Windows case-fold behavior — built directly via `new PermissionManager({ policyLoader: createInMemoryPolicyLoader(...), platform: "win32" })`.
- No architecture-roadmap step marker to flip — #509 was confirmed in planning to not be part of any roadmap phase.

[#520]: https://github.com/gotgenes/pi-packages/issues/520
