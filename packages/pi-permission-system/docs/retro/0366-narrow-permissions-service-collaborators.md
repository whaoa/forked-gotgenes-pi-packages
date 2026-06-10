---
issue: 366
issue_title: "Narrow `LocalPermissionsService` collaborators to interfaces"
---

# Retro: #366 — Narrow `LocalPermissionsService` collaborators to interfaces

## Stage: Planning (2026-06-10T00:00:00Z)

### Session summary

Produced the implementation plan for narrowing `LocalPermissionsService`'s three constructor parameters from concrete classes (`PermissionManager`, `SessionRules`, `ToolInputFormatterRegistry`) to abstractions.
Confirmed against the source that the design is fully prescribed by both the issue and the Phase 5 Track C roadmap in `docs/architecture/architecture.md`: reuse `ScopedPermissionManager`, `Pick<SessionRules, "getRuleset">`, and a new `{ register }` interface.
Skipped the `ask-user` gate — the proposed change is unambiguous.

### Observations

- The change is type-only and non-breaking; `src/index.ts` (the sole production construction site) needs no edit because the concrete instances structurally satisfy the narrower parameter types.
- New write-side interface `ToolInputFormatterRegistrar` mirrors the existing read-side `ToolInputFormatterLookup` in `tool-input-formatter-registry.ts`; the concrete registry gains it in its `implements` clause.
- ISP tradeoff noted: `ScopedPermissionManager` declares 5 methods but the service calls only 2.
  Reuse is a deliberate, documented decision (consistency with `PermissionSession` / `PermissionResolver`); the testability goal still holds because the test mock factory return type is a `Pick` of the two exercised methods.
- Planned as a single Red→Green→Commit cycle (`refactor:`): removing the three `as unknown as` casts in `permissions-service.test.ts` fails `tsc` until the constructor types are narrowed, so the test simplification and production narrowing land in one commit.
- The roadmap `✓ complete` mark on Track C Step 5 is deferred to ship time, per the package skill — not part of this plan's commits.

## Stage: Implementation — TDD (2026-06-10T09:35:00Z)

### Session summary

Implemented the narrowing across three commits (the plan's single cycle was decomposed at the user's request — "make the change that makes the change easy").
No test-count change: `permissions-service.test.ts` still has 7 tests (1902 package-wide), now with zero `as unknown as` casts.
All deterministic gates pass: `check`, `lint`, full `test`, and `fallow dead-code`.

### Observations

- Deviation from plan: the single planned `refactor:` commit became three — (A) `feat:` add `ToolInputFormatterRegistrar` (pure addition + `implements`); (B) `test:` reuse the shared `makeFakePermissionManager()` fixture in place of the hand-rolled 2-method stub (kept the cast temporarily); (C) `refactor:` narrow the three constructor params and drop all casts.
  Kent-Beck tidy-first sequencing: A and B are behavior-preserving preparation that shrank C to an 18-line diff.
- Considered but rejected option C from discussion (narrowing the manager param to `Pick<ScopedPermissionManager, "checkPermission" | "getToolPermission">`): kept the full `ScopedPermissionManager` per the plan/roadmap consistency decision.
  Reusing the shared `makeFakePermissionManager()` (5-method fake) made the full interface free of extra hand-rolled stubs.
- `makeFakePermissionManager`'s default `checkPermission` return differs from the old local stub's `makeCheckResult()`, but no test in the file asserts that default (the relevant test overrides via `mockReturnValue`), so the swap was safe.
- The pre-completion reviewer's WARN (two stale `architecture.md` lines describing the injected collaborators and the registry module) was addressed in this session with a `docs:` commit, not deferred — only the roadmap `✓ complete` mark remains for ship time.
- Pre-completion reviewer: PASS (ready for `/ship-issue`).
  Reviewer warnings: two `architecture.md` staleness items — both now fixed in commit `docs: reflect narrowed LocalPermissionsService collaborators in architecture (#366)`.
