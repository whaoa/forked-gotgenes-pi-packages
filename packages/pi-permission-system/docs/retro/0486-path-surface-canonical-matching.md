---
issue: 486
issue_title: "pi-permission-system: should the path surface match the canonical (symlink-resolved) form like external_directory?"
---

# Retro: #486 — Make the `path` surface match the canonical (symlink-resolved) form

## Stage: Planning (2026-06-27T14:43:53Z)

### Session summary

Resolved the decision #486 tracked: the operator chose to make the `path` surface match the canonical (symlink-resolved) form, bringing it to parity with `external_directory`.
A second `ask_user` settled implementation scope as "full" — migrate **both** `path` producers (the tool path gate and the bash-path gate) onto `AccessPath`, pulling the bash-path migration slice forward from [#487].
Produced `docs/plans/0486-path-surface-canonical-matching.md` (5 TDD steps) and committed it.

### Observations

- The change is **breaking**: adding the canonical alias to the `path` match set alters which rules fire on upgrade with no user edit (a symlink slipping past a `path: deny` now matches).
  Plan uses `feat(pi-permission-system)!:` with a `BREAKING CHANGE:` footer for the two behavior steps.
  The operator explicitly asked to confirm this.
- The match set is already single-sourced: `AccessPath.matchValues()` returns exactly `lexical ∪ canonical`, and the resolver already unwraps an `access-path` intent via `matchValues()`.
  So the change is mechanical — both producers emit `access-path`; the manager stays string-based and untouched.
- Key invariant to preserve: the [#393] unknown-base case (a relative bash token after a non-literal `cd` keeps its literal value only — no canonical, no spurious absolute).
  The plan routes that case through a new `AccessPath.forLiteral` (literal-only, empty boundary) rather than `forPath`.
- `forExternalDirectory` is generalized/renamed to a surface-neutral `forPath(pathValue, { cwd, resolveBase? })`; behavior-identical for external-directory callers because `resolveBase` defaults to `cwd`.
- Scope pulled forward from [#487]: the bash-path `AccessPath` migration and the collapse of the now-unproduced emitted `path-values` `AccessIntent` variant.
  No new issue filed — work is pulled forward, not deferred.
  [#487]'s residual scope is config-pattern and prompt-input migration only.
- Release: ship independently (not in any active batch; Phase 6 closed; breaking → own major-bump release).

## Stage: Implementation — TDD (2026-06-27T15:12:45Z)

### Session summary

Implemented all 5 TDD steps across 5 commits: added `AccessPath.forPath`/`forLiteral` factories, migrated the tool path gate (`path.ts`) and the bash-path gate (`bash-path.ts` + `cwd-projection.ts`) to emit `access-path` intents, and collapsed the gate-emitted `path-values` variant.
The `path` surface now matches the lexical aliases ∪ canonical (symlink-resolved) form like `external_directory` (#418 parity).
Test count went from 2145 → 2154 (net +9: added factory/`forLiteral`/canonical-alias tests across steps 1–3, removed one redundant `path-values` passthrough resolver test in step 4).

### Observations

- Two benign deviations from the plan's Module-Level Changes: `src/permission-resolver.ts` needed no source change (its `toResolvedIntent` fallthrough `return intent` already handles the narrowed `tool`-only case; `tsc` passes), and `src/access-intent/bash/program.ts` needed no change (the `BashPathRuleCandidate` shape change flows through the re-export).
  The plan anticipated the latter as a "verify" item.
- The plan's design held exactly: `AccessPath.matchValues()` already computed `lexical ∪ canonical`, and the resolver already unwrapped `access-path`, so the manager stayed string-based and untouched.
  No surprises.
- Test-fixture ripple: removing `path-values` from the emitted `AccessIntent` union surfaced three inline resolver mocks (`bash-external-directory.test.ts`, two in `external-directory-policy.test.ts`) that branched on `intent.kind === "path-values"`; those dead branches became `tsc` no-overlap errors and were simplified.
  `makePathDispatchResolver` (gate-fixtures) was likewise simplified to `tool | access-path`.
  The `makeHandler` adapter on `permissionManager.check` keeps its `path-values` branch (the manager still consumes the resolver-internal `ResolvedAccessIntent`).
- `noUncheckedIndexedAccess` is off in this package: `candidates[0]?.path` tripped `@typescript-eslint/no-unnecessary-condition`; fixed by dropping the `?.` on array-index access (kept it on `.find()` results).
- Removing `getPolicyValuesForRuleCandidate` (dissolved into the new private `buildRuleCandidatePath`) orphaned the `getPathPolicyValues` import in `cwd-projection.ts` — caught by biome `noUnusedImports` (warning-level) at the root lint, removed.
- Pre-completion reviewer: PASS (all deterministic checks green, all four documented invariants — #418/#393/#382/#478 — verified, Mermaid blocks validate, no dead code).
