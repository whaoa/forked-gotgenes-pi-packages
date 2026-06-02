---
issue: 318
issue_title: "Introduce an McpTargetList value object in mcp-targets.ts"
---

# Retro: #318 — Introduce an `McpTargetList` value object in `mcp-targets.ts`

## Stage: Planning (2026-06-02T00:00:00Z)

### Session summary

Produced the implementation plan for replacing the `pushTarget` closure in `src/mcp-targets.ts` with an `McpTargetList` value object that owns the ordered-uniqueness invariant.
This is Track C / Step 5 of the architecture roadmap (Finding 4).
The change is behavior-preserving — the existing `test/mcp-targets.test.ts` is the regression guard and candidate ordering is unchanged.

### Observations

- The design is unambiguous per the issue; only one decision needed surfacing: whether `McpTargetList` is exported with direct unit tests or kept module-private.
  Confirmed with the user via `ask_user` — chose **export + direct unit tests**, mirroring the existing `parseQualifiedMcpToolName` (exported + tested) precedent in the same module.
  This adds a new red→green cycle (Step 1) documenting the invariant in isolation.
- Both Non-Goals from the issue were preserved in the plan: no MCP-naming command methods on the list (keeps ordering+uniqueness separate from the `${server}_${tool}` spelling), and no `McpInvocation`/`deriveTargets()` class (a one-shot transform in a class costume).
- Sole production consumer is `src/input-normalizer.ts` (line 106), which spreads the result — so `toArray()` returning a defensive copy (`[...this.targets]`) instead of the live array is behavior-preserving and strictly safer.
- The two private helpers (`pushMcpToolPermissionTargets`, `addDerivedMcpServerTargets`) already took a `pushTarget` callback, so swapping it for an injected `McpTargetList` is a clean DIP-friendly substitution with no LoD / output-argument / reverse-search concerns.
- Grep confirmed no `src/`, `test/`, or skill file references the changed symbols beyond `input-normalizer` and the two test files; the architecture doc (Finding 4 / Step 5) is the only doc needing an update.
- TDD order is 3 cycles: (1) `test:` add `McpTargetList` + tests, (2) `refactor:` rewrite dispatch, (3) `docs:` mark roadmap Step 5 done.
  Next step is `/tdd-plan`.

## Stage: Implementation — TDD (2026-06-02T17:10:00Z)

### Session summary

Completed all 3 TDD cycles from the plan: (1) exported `McpTargetList` class with 6 focused unit tests, (2) rewrote `createMcpPermissionTargets`, `pushMcpToolPermissionTargets`, and `addDerivedMcpServerTargets` to construct and tell an `McpTargetList` instead of threading a `pushTarget` callback, (3) updated `docs/architecture/architecture.md` to mark Finding 4 and Step 5 as ✅ resolved.
Test count rose from 1753 to 1759 (+6 new `McpTargetList` invariant tests).
All deterministic checks (check, lint, test, fallow dead-code) passed throughout.

### Observations

- No deviations from the plan.
  The two private helpers (`addDerivedMcpServerTargets`, `pushMcpToolPermissionTargets`) already accepted a `pushTarget` callback, making the swap to an injected `McpTargetList` mechanical — exactly as anticipated.
- `toArray()` returning a defensive copy (`[...this.targets]`) was confirmed safe: the sole consumer (`input-normalizer.ts`) spreads the result, so the copy is behavior-invisible.
- Pre-completion reviewer: **PASS**.
  One WARN noted: the stepdown ordering in `src/mcp-targets.ts` has private helpers listed above the exported caller (`createMcpPermissionTargets`) — this is pre-existing (not introduced by this PR) and left for a future cleanup.
- Next step is `/ship-issue #318`.
