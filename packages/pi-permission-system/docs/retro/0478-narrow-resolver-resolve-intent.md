---
issue: 478
issue_title: "pi-permission-system: narrow ScopedPermissionResolver to a single resolve(intent) (Phase 6 Step 6)"
---

# Retro: #478 — Narrow `ScopedPermissionResolver` to a single `resolve(intent)`

## Stage: Planning (2026-06-26T00:00:00Z)

### Session summary

Produced `docs/plans/0478-narrow-resolver-resolve-intent.md` for Phase 6 Step 6: introduce a three-variant `AccessIntent` that each gate emits, collapse the resolver's `resolve` + `resolvePathPolicy` into one `resolve(intent)`, and unify the manager's `checkPermission` + `checkPathPolicy` into one `check(intent, sessionRules?)`.
The change is behavior-preserving and ships independently (roadmap `Release: independent`).
Filed two follow-up issues surfaced during the design discussion: [#486] (should the `path` surface match canonical like `external_directory`?) and [#487] (adopt `AccessPath` as the universal internal path representation).

### Observations

- **Three-variant union, not two.**
  The decisive design call was the shape of `AccessIntent`.
  The operator pushed back on suppressing `AccessPath` ("we built it — why prevent it flowing?").
  Investigating the actual data settled it: bash-path's `path` surface matches the lexical aliases only (`getPathPolicyValues`), while `AccessPath.matchValues()` adds the canonical alias for `external_directory` (the [#418] set).
  So `path-values` and `access-path` are genuinely distinct variants — forcing bash-path through `AccessPath` would inject a canonical alias the `path` surface does not match today (a behavior change).
  The `tool` variant stays separate because only the manager can normalize raw input.
  Result: `tool | path-values | access-path`.
- **Resolver unwraps, manager stays string-based.**
  The operator chose to let `AccessPath` flow into the resolver (Tell-Don't-Ask: the resolver asks `path.matchValues()`), but keep the low-level `PermissionManager` matching over plain strings.
  Hence two types: public `AccessIntent` (3 variants) and `ResolvedAccessIntent` (2 variants) for the manager — the access-path variant is unwrapped in `toResolvedIntent` before the manager sees it.
- **Full manager collapse kills the false-green structurally.**
  The [#393] false-green was a stubbed-but-unrouted manager method.
  The operator chose full collapse to a single `check(intent)` (migrating the raw query callers `permissions-service` / `skill-prompt-sanitizer` / `permission-event-rpc`, plus the resolver's raw `checkPermission`), so there is no second method to forget.
- **Scope discipline.**
  Resisted scope creep into `path`-surface canonical matching and the universal-`AccessPath` migration; both were filed as separate issues ([#486], [#487]) rather than folded in.
  The plan's `path-values` variant is explicitly the transitional accommodation that shrinks under [#487].
- **TDD sequencing risk.**
  The interface removals (manager `check`, resolver `resolve(intent)`) break every typed mock at once.
  Planned lift-and-shift (new method alongside old → incremental gate migration → removal/rename) to avoid a single giant test rewrite, with a noted fallback to an atomic resolver commit if `/tdd-plan` judges the six call sites manageable.
- **Doc-staleness surface.**
  `architecture.md` carries the resolver surface in a health-metric row, the access-intent directory listing, and per-module narrative descriptions (`bash-path.ts`, `external-directory-policy.ts`); the package `SKILL.md` carries the [#393] / [#418] fixture-wiring notes that become obsolete (single method).
  Both are listed as doc updates.

[#393]: https://github.com/gotgenes/pi-packages/issues/393
[#418]: https://github.com/gotgenes/pi-packages/issues/418
[#486]: https://github.com/gotgenes/pi-packages/issues/486
[#487]: https://github.com/gotgenes/pi-packages/issues/487
