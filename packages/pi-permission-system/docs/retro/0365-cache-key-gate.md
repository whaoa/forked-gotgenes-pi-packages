---
issue: 365
issue_title: "Encapsulate agent-start cache keys in a `CacheKeyGate` class"
---

# Retro: #365 — Encapsulate agent-start cache keys in a `CacheKeyGate` class

## Stage: Planning (2026-06-09T00:00:00Z)

### Session summary

Produced a four-step plan to extract a `CacheKeyGate` class, replace `PermissionSession`'s four anemic cache methods + two fields with two exposed gate sub-objects, collapse `AgentPrepHandler`'s two ask-then-tell pairs into `runIfChanged` tells, and remove the test-only-alive `shouldApplyCachedAgentStartState`.
Confirmed Track A (`#362`–`#364`) is closed and shipped, so no `permission-session.ts` merge coordination is needed despite the roadmap's note.

### Observations

- Resolved one genuine design ambiguity via `ask_user`: the handler reaches the gates through `readonly` properties on `PermissionSession` (`session.activeToolsGate.runIfChanged(...)`) rather than through two thin delegating methods.
  This matches the roadmap's "0 anemic cache accessors / 2 owned `CacheKeyGate` sub-objects" target.
- Chose run-then-commit ordering for `runIfChanged`, unifying the two paths.
  The prompt path previously committed before its sanitization work; the only observable change is on the throw path (now retried, strictly safer).
  Flagged in Risks.
- Grep confirmed the four session methods and `shouldApplyCachedAgentStartState` are referenced only in `before-agent-start.ts` and three test files — no `SKILL.md` or composition-root references.
- Step 2 is deliberately a single combined commit: removing the four methods breaks the handler and both test files at once, so the extraction + consumer updates + consumer-test updates must land together.
- The key builders (`createActiveToolsCacheKey`, `createBeforeAgentStartPromptStateKey`) stay; only the comparison helper is removed.
- Noted that Track A steps were not individually marked `✓ complete` in `architecture.md`; Step 4 of the plan marks this step complete per the package-skill convention, leaving back-fill out of scope.

## Stage: Implementation — TDD (2026-06-09T23:41:00Z)

### Session summary

Completed all four TDD steps: added `CacheKeyGate` with 7 unit tests; migrated `PermissionSession` and `AgentPrepHandler` to use two `readonly` gate sub-objects; removed the dead-in-production `shouldApplyCachedAgentStartState`; marked Phase 5 Step 4 complete in the architecture doc.
Test count: 1903 → 1902 (net −1: removed the dedupe test and four spy-based handler tests; added 7 `CacheKeyGate` unit tests and 2 behavior-driven handler tests).
All checks pass: `pnpm run check`, `pnpm run lint`, `pnpm run test`, `pnpm fallow dead-code`.

### Observations

- Step 2 was implemented as a single combined commit as planned: removing the four `PermissionSession` methods broke the handler and both test files simultaneously at the type level, so all consumer updates landed together.
  The `pnpm run check` type error list cleanly identified exactly the lines to rewrite.
- The `cache key methods` describe block in `permission-session.test.ts` (5 tests) was removed; the three lifecycle "clears cache keys" tests were rewritten to prime gates via `runIfChanged` and assert re-arming after the lifecycle call.
- The four spy-based handler tests (`vi.spyOn(session, "commitActiveToolsCacheKey")` etc.) were replaced with two behavior-driven tests: one asserting `setActive` is called exactly once across repeated identical calls, and one asserting repeated calls return `{}`.
- Pre-completion reviewer returned WARN (not FAIL): one unused `createActiveToolsCacheKey` import left over in `test/before-agent-start-cache.test.ts` after the dedupe test was removed; fixed by amending the step 3 commit before shipping.
