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

## Stage: Implementation — TDD (2026-06-26T23:15:00Z)

### Session summary

Implemented Phase 6 Step 6 across six commits: added `ScopedPermissionManager.check(intent)` alongside the old pair, routed all manager callers through it (keeping thin class wrappers temporarily), removed `checkPermission`/`checkPathPolicy` from the interface, narrowed `ScopedPermissionResolver` to one `resolve(intent: AccessIntent)`, dropped the manager class wrappers, and updated docs.
Net test delta: +9 manager `check` cases in step 1, then a net −1 from consolidating the redundant `resolve`/`resolvePathPolicy` resolver tests into intent-variant cases (2125 → 2124 total).
Final state: 103 test files, 2124 tests green; `tsc`, root `lint`, and `fallow dead-code` all clean.

### Observations

- **Steps 3-4 collapsed into one atomic resolver-narrowing commit**, as the plan's TDD Order explicitly permitted.
  Surveying the gate tests showed `runner.test.ts` (35 resolve refs) mostly uses the `resolveResult` fixture param (return-value config, unaffected by the signature change) — only one assertion checked call args.
  The atomic narrowing was clearly less total churn than lift-and-shift's add-then-rename pass.
- **Step 2 split into two commits.**
  To avoid rewriting the 3500-line `permission-manager-unified.test.ts` (184 `checkPermission` + 6 `checkPathPolicy` call sites) in the interface-removal commit, I kept `checkPermission`/`checkPathPolicy` as thin class-only wrappers over `check` (off the interface — the false-green guarantee holds on the interface), then removed them in a follow-up `refactor` commit that migrated the test file via two local intent-building adapters (`checkTool` / `checkPathValues`).
  A `sed` prefix-replacement (`manager.checkPermission(` → `checkTool(manager, `) made the 190-site migration safe and mechanical.
- **`PermissionResolver implements SkillPermissionChecker`** (not in the plan's exact wording) resolved a fallow finding: once `resolve` stopped calling `this.checkPermission` internally, the raw `checkPermission` was only reachable via two structural interfaces (skill-input gate, skill-prompt sanitizer) that fallow can't trace.
  Declaring the documented contract is the fallow-skill-preferred fix over suppression; it also made `PermissionManager` no longer satisfy `SkillPermissionChecker` (it lost `checkPermission`), so two sanitizer tests gained a small `asChecker` adapter.
- **Fixture simplification killed the #393 false-green structurally.**
  `makeFakePermissionManager` went from `checkPermission` + `checkPathPolicy` stubs to a single `check`; `makeHandler` routes the surface-check override onto that one method via an intent→(surface, input) adapter.
  There is no second method a fixture can stub-but-forget.
- **Pre-completion reviewer: WARN** (no FAILs).
  Two non-blocking findings.
  Fixed #1 (Track B in `architecture.md` now marked ✅ complete since Steps 4-6 all landed, following the Track A convention).
  Left #2: the reviewer noted `SkillPermissionChecker` lives in `skill-prompt-sanitizer.ts` (its role-defining consumer) rather than co-located with its sole implementor `permission-resolver.ts`; the `type`-only import is benign (no cycle) and the fallow rationale justifies the current placement — relocating the interface is out of scope.

[#393]: https://github.com/gotgenes/pi-packages/issues/393
[#418]: https://github.com/gotgenes/pi-packages/issues/418
[#486]: https://github.com/gotgenes/pi-packages/issues/486
[#487]: https://github.com/gotgenes/pi-packages/issues/487
