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
