---
issue: 207
issue_title: "Decompose update in agent-widget.ts (cognitive 31)"
---

# Retro: #207 — Decompose `update` in `agent-widget.ts`

## Stage: Planning (2026-05-25T04:12:00Z)

### Session summary

Planned the decomposition of `update` (cognitive complexity 31) into an exported pure `assembleWidgetState` function, a `clearWidget` method, and an `updateStatusBar` method.
The plan follows the Phase 12 pattern established by Steps 1 and 2 (#205, #206) — extract pure functions where possible, otherwise extract methods, and simplify the original function to a thin orchestrator.

### Observations

- The sibling plans (#205, #206) provided a clear template for this plan — structure, section ordering, and test impact analysis all followed the established pattern.
- There are **no existing tests** for `AgentWidget` — the only testable concern is the newly extracted `assembleWidgetState` pure function.
  The rest of the refactoring is a mechanical extraction verified by the type checker.
- `categorizeAgents` in `widget-renderer.ts` does a similar filter but returns full arrays (for rendering), while `assembleWidgetState` returns lightweight counts (for lifecycle decisions).
  Different outputs for different consumers — no duplication concern.
- No `ask_user` was needed — the issue's "Proposed change" section was unambiguous and the design pattern was well-established by the two preceding Phase 12 steps.

## Stage: Planning — revision (2026-05-25T16:00:00Z)

### Session summary

Reviewed and revised the prior plan after a thorough code audit of `agent-widget.ts`, `widget-renderer.ts`, `agent-record.ts`, and `runtime.ts`.
Three design changes were made to the original plan.

### Observations

- **Narrowed the input type:** Changed `assembleWidgetState` from accepting `WidgetAgent[]` (10+ fields) to a local `AgentSummary` interface (3 fields: `id`, `status`, `completedAt?`).
  The original plan violated ISP — the function only reads 3 fields, so requiring full `WidgetAgent` fixtures in tests would be needless friction.
  `AgentRecord` satisfies `AgentSummary` structurally, so no adapter is needed at the call site.
- **Kept `dispose` independent:** The original plan made `dispose` delegate to `clearWidget`, but `dispose` and `update`'s idle path have different lifecycle semantics — `dispose` uses unconditional teardown (correctness guarantee), while `update`'s idle path uses guarded calls (avoiding redundant SDK calls during repeated ticks).
  `dispose` also skips stale-entry cleanup (the Map is about to be GC'd).
  Per the code-design skill's Sandi Metz principle, this is structural duplication that should not be extracted.
- **Added complexity budget table:** Explicitly estimated cognitive complexity for each extracted function to verify the < 10 target is achievable across the board.
