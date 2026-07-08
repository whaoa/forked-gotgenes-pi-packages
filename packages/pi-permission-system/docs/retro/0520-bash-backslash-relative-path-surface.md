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
