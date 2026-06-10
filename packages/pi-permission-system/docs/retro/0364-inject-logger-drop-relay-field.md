---
issue: 364
issue_title: "Inject `logger` directly; drop the relay-only field from `PermissionSession`"
---

# Retro: #364 — Inject `logger` directly; drop the relay-only field from `PermissionSession`

## Stage: Planning (2026-06-10T02:42:19Z)

### Session summary

Produced a two-step (plus one docs-step) implementation plan for Phase 5 Step 3 (Track A) of the pi-permission-system roadmap: inject `SessionLogger` directly into `SessionLifecycleHandler` and `GateDecisionReporter`, then drop the relay-only `readonly logger` field from `PermissionSession` (constructor 7 → 6 args).
Confirmed both prerequisites ([#362], [#363]) are CLOSED and present on `main`, so the dependency on Step 2 is satisfied.

### Observations

- A full-tree grep found exactly four `session.logger` reach-throughs (three in `handlers/lifecycle.ts`, one reporter-wiring in `index.ts`) plus three test reads in `external-directory-integration.test.ts`.
  `permission-session.test.ts` has zero `logger` references, so nothing asserts the field directly.
- The change is non-breaking — internal wiring only — so commit types are `refactor:` / `docs:`, matching the pattern prior steps [#362] and [#363] used.
- TDD ordering is driven by TypeScript's type-level interlock: Step 1 (inject into the handler) can land alone because it keeps `PermissionSession.logger` in place; Step 2 must fold the field removal, both `new PermissionSession(…)` call sites, the reporter rewire, the `makeHandler` return addition, and the external-directory test re-point into one commit, since removing the field breaks every construction site and every `session.logger` read simultaneously.
- Identified a genuine test improvement: today `makeRealSession` returns the same logger the session holds, so `lifecycle.test.ts` cannot distinguish "uses `session.logger`" from "uses an injected logger."
  Step 1's red→green injects a session-independent logger so the existing `logger.warn` / `logger.debug` assertions become a real test of direct injection.
- Deferred (Open Question): the stale `logger` member on the `MockGateHandlerSession` test type and its SKILL.md mention — tidy-up only, revisit during implementation if it proves to be dead weight.
- Design-review checklist run: the handler gains a fourth dep (`logger`) it fully uses, replacing an indirect reach-through; no output-argument, scattered-reset, or parameter-relay smells are introduced.

[#362]: https://github.com/gotgenes/pi-packages/issues/362
[#363]: https://github.com/gotgenes/pi-packages/issues/363

## Stage: Implementation — TDD (2026-06-10T02:56:30Z)

### Session summary

Completed all three planned TDD steps plus one unplanned cleanup commit in a single session.
Two `refactor:` commits implement the injection and field removal; one `docs:` commit updates the package skill; one additional `refactor:` commit removes the stale `logger` member from `MockGateHandlerSession` (the plan's deferred Open Question, resolved in-session).
Test count held at 1903 across 91 files — no new tests, no regressions.

### Observations

- Step 1 (inject into `SessionLifecycleHandler`) landed cleanly on its own: the four-argument constructor, three `this.logger.*` replacements, and `index.ts` wiring update all compiled without touching `PermissionSession`.
- Step 2's atomic commit covered six files as predicted: `permission-session.ts`, `index.ts`, `session-fixtures.ts`, `handler-fixtures.ts`, `external-directory-integration.test.ts` — the TypeScript type-level interlock enforced the boundary correctly.
- The `lifecycle.test.ts` red-phase used a session-independent `makeLogger()` instance, confirming the existing `logger.warn` / `logger.debug` assertions now genuinely test direct injection rather than reach-through.
- The Open Question (`MockGateHandlerSession.logger`) was resolved in-session: confirmed no test ever passed `logger` through the session override bag, the `SessionLogger` import became unused after removal, and `fallow dead-code` stayed clean.
  Cleaned up in commit 4 `refactor: remove stale logger member from MockGateHandlerSession (#364)`.
- Pre-completion reviewer: PASS — all deterministic checks clean, code design and test artifacts reviewed, SKILL.md updates verified.
