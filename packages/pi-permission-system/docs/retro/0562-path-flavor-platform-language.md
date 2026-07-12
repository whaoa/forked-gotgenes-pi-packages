---
issue: 562
issue_title: "Leaf path modules re-derive the win32 path flavor from a raw platform parameter"
---

# Retro: #562 — Leaf path modules re-derive the win32 path flavor from a raw platform parameter

## Stage: Planning (2026-07-10T00:00:00Z)

### Session summary

Planned Phase 10 Step 3: introduce `PathFlavor`, the resolved product of the single `platform === "win32"` decision, and thread it into the path leaves in place of the raw `platform` string.
The design deepened well past the issue's original "value object with a fold" framing through operator questioning: `PathFlavor` became a **behavioral collaborator** — the platform's path *language* (syntax `hasPathSeparator`, semantics `bashTokenShape`, equivalence `fold`/`comparable`/`isWithin`/`matchOptions`) — injected once from `index.ts`, dissolving `PathNormalizer`'s two `!== "win32"` guards and removing `NodeJS.Platform` from every domain signature.
Plan committed with a 10-step bottom-up lift-and-shift TDD order; follow-up [#571] filed for the deferred subagent-containment unification.

### Observations

- The operator explicitly pushed scope wider than the issue: three rounds of `ask_user` converged on (a) behavioral over data-bag, (b) tell-don't-ask (`hasPathSeparator` replacing the leaked `usesWindowsSeparators()` accessor read by `bash-path-resolver`), and (c) threaded construction from the composition root over internal construction.
- Zoom-out finding: every platform-conditional in the package factors into exactly three capability groups (syntax / semantics / equivalence), which is what justifies one cohesive `PathFlavor` object rather than a config bag.
- Two genuine findings surfaced during the full platform-shaped sweep: a second divergent containment algorithm in `subagent-context` (`isPathWithinDirectoryForSubagent`, the same must-agree smell — deferred to [#571] because unifying it is behavior-affecting), and the `BashDialect` axis (kept as one object because pi core fixes the win32⇔Git-Bash pairing — track-and-watch).
- Decided `impl: PlatformPath` is exposed, not wrapped — its post-migration consumers are all path-domain primitives and `PlatformPath` is Node's own strategy; wrapping would be pure ceremony.
  Sealable later in two lines.
- `permission-manager.ts` can consume `PathFlavor` without violating ADR-0002 — the `no-restricted-imports` guard bans only `access-intent/access-path`, and `PathFlavor` is a plain value object in `src/path/`.
- Verified the whole change is behavior-preserving, so every implementation commit is `refactor:` (hidden changelog type) — the roadmap's `Release: independent` means it lands on `main` and auto-batches, not that it cuts its own release (Refs [#479]).
- Lift-and-shift bridge is safe: `pathFlavorForPlatform` returns cached singletons, so the transitional inline `pathFlavorForPlatform(platform)` at not-yet-migrated call sites cannot diverge and stays bypass-safe until step 8 removes it.

## Stage: Implementation — TDD (2026-07-11T21:40:00Z)

### Session summary

Executed all 10 planned steps as 11 commits (10 `refactor:` + 1 `docs:`), a bottom-up lift-and-shift that introduced `PathFlavor` and threaded it in place of the raw `platform` discriminator across every path leaf, `rule.ts`/`PermissionManager`, `PathNormalizer`, and subagent detection, injecting it once from `index.ts`.
The suite moved 2321 → 2329 (net +8: +16 `path-flavor.test.ts`, −8 from removed `usesWindowsSeparators` tests and merged duplicate classifier cases); `check`/`lint`/`fallow`/full-suite all green throughout, and the behavior-preserving invariants ([#382]/[#508], [#533], [#520], [#510]) stayed pinned.
Pre-completion reviewer: PASS — ready for `/ship-issue`.

### Observations

- The design over-delivered on the roadmap's headline metric: `platform === "win32"` *code* comparisons are exactly 1 (the factory).
  The naive `grep 'platform === "win32"'` initially reported 3 because two `path-flavor.ts` doc comments quoted the phrase — reworded them (separate `refactor:` commit) so the metric grep honestly reports 1.
- Planned-metric deviation, recorded transparently rather than forced: the roadmap predicted `caseInsensitive` derivations “≤ 2” but the grep reports 4.
  The real win32 match-options *literal* derivation dropped 2 → 1 (sole literal now in `path-flavor.ts`); the other 3 grep hits are the intrinsic `WildcardMatchOptions` definition in `wildcard-matcher.ts`, which is not a win32 derivation.
  The architecture health-metrics row now decomposes the raw count instead of contorting code to hit “≤ 2”.
- `posixFlavor.bashTokenShape()` returning `{ kind: "plain" }` for every token is the keystone that let `PathNormalizer` drop *both* `!== "win32"` guards into one uniform `switch` — the posix “plain” branch exactly reproduces the old posix early-return, so no behavior changed.
- `hasPathSeparator` collapsed the classifier's two separator checks (`includes("/")` + `windowsSeparators && includes("\\")`) into one call and let `RuleCandidateOptions` be deleted outright — the tell-don't-ask win from the planning `ask_user` rounds paid off cleanly.
- Two perl-scripting hazards hit during the ~30-site test migration: (1) a bash `for f in $FILES` loop silently failed to apply (re-ran with explicit file args), and (2) a `classifyTokenAsRuleCandidate\(([^,)]+)\)` regex corrupted a string literal containing `)` (`"\\(group\\)"`), which `pnpm run check` did not catch (esbuild ran, the string was just wrong) — caught by rewriting that describe block by hand.
  Reinforces the AGENTS.md warning against scripted multi-line substitution across similar blocks.
- ADR-0002 needed no edit: the manager now consumes `PathFlavor` but still never imports `AccessPath`, so the string boundary holds — the `no-restricted-imports` guard bans only `access-intent/access-path`.

[#479]: https://github.com/gotgenes/pi-packages/issues/479
[#571]: https://github.com/gotgenes/pi-packages/issues/571
