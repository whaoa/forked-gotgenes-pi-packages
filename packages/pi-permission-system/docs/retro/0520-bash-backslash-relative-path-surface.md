---
issue: 520
issue_title: "Bash backslash-relative arguments (dir\\file) bypass the path permission surface on Windows"
---

# Retro: #520 — Bash backslash-relative arguments (dir\\file) bypass the path permission surface on Windows

## Stage: Planning (2026-07-08T00:00:00Z)

### Session summary

Produced a numbered TDD plan for the win32 backslash-relative shape-recognition gap in the bash `path` surface, the sibling deferred from [#509].
The fix widens `classifyTokenAsRuleCandidate` with an optional `{ windowsSeparators }` branch (accepting a `\`-containing token as path-shaped) and derives that bit from a new narrow `PathNormalizer.usesWindowsSeparators()` accessor threaded through `BashPathResolver.projectRuleCandidates`, so the platform decision stays in the normalizer and never re-reads `process.platform`.

### Observations

- Scope confirmed `path`-surface only: the forward-slash equivalent `dir/file` is already dropped by the strict `external_directory` classifier, and a backslash *traversal* (`..\x`) is already caught by the shared `includes("..")` branch, so no `external_directory` change is needed.
- Chose an optional classifier option + narrow normalizer accessor over reviving the retired generic `getPlatform()` — `usesWindowsSeparators()` is a bounded semantic predicate (like `isAbsolute`), and `windowsSeparators` reuses the existing convention in `wildcard-matcher.ts` / `rule.ts`.
- Dead-code avoidance drove the TDD sequencing: the new normalizer accessor lands in the same step as its sole consumer (the resolver) so `pnpm fallow dead-code` stays clean; the classifier param is optional so no fake breaks.
- Non-breaking and platform-specific: POSIX keeps `dir\file` as a bare token (backslash is a legal filename char there), pinned by a `posix`-normalizer resolver test; the design reuses `forBashToken` (win32 `plain`) resolution and the `pathMatchOptions` `/`→`\` fold so `dir\file` matches a natural `"dir/file"` rule.
- `Release: ship independently` — [#520] is recorded under the Phase 9 "swept and out of scope" listing and is in no release batch.

## Stage: Implementation — TDD (2026-07-08T11:00:00Z)

### Session summary

Executed all four TDD-order steps: the `{ windowsSeparators }` option on `classifyTokenAsRuleCandidate`, the `PathNormalizer.usesWindowsSeparators()` accessor wired into `BashPathResolver.projectRuleCandidates`, an end-to-end `describeBashPathGate` win32 deny repro, and the docs.
The `pi-permission-system` suite went from 2275 to 2287 tests (+12); full monorepo suite, `check`, `lint`, and `fallow dead-code` all green.
Pre-completion reviewer verdict: PASS.

### Observations

- One planned deviation: the win32 parity test asserts the backslash token's exact `matchValues()` (`["c:\\projects\\app\\dir\\file", "dir\\file"]`) plus a superset check against the forward-slash token, rather than the plan's predicted strict `matchValues()` equality — the forward-slash form `dir/file` carries a redundant raw `dir/file` alias that folds to `dir\file` under win32 separators, so rule-match parity holds without the two match sets being identical.
  Captured in the `ad90fe56` commit body.
- Baseline cleanup: the committed plan tripped `MD053` (an unused `[#393]` link-reference definition, since every `#393` body mention was backticked) — fixed as a separate `docs:` commit before starting TDD.
- `noUncheckedIndexedAccess` is off in this package, so `arr[0]` is non-nullable; an initial `candidate?.token` / `?? []` in the new `program.test.ts` cases tripped `@typescript-eslint/no-unnecessary-condition` at the pre-commit hook — dropped the optional chaining to match the file's existing convention.
- tree-sitter-bash preserves the raw `dir\file` source text in the `word` node (no shell escape processing), so the classifier sees the backslash literally — the token-collection layer does not interpret escapes, matching the existing design.
- Confirmed the fix is not a hollow test: before the change `dir\file` produced no rule candidate, so the win32 gate returned null; the new deny assertion genuinely fails without the fix.
- No roadmap `✅` flip: [#520] is not a numbered roadmap step (swept out of scope), so only the architecture module-listing prose was updated.
