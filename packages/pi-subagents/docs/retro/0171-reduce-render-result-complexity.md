---
issue: 171
issue_title: "refactor(pi-subagents): reduce renderResult complexity (cognitive 43)"
---

# Retro: #171 — refactor(pi-subagents): reduce renderResult complexity

## Stage: Planning (2026-05-24T20:00:00Z)

### Session summary

Produced a plan to extract per-status rendering from `renderResult` in `tools/agent-tool.ts` into a new `tools/result-renderer.ts` module with seven pure functions and a dispatcher.
The TDD order has 9 steps: 7 test-first steps (one per function) followed by 2 refactor steps (extract, then simplify).

### Observations

- No existing tests cover `renderResult` — all `agent-tool.test.ts` tests exercise `execute` paths and tool metadata only.
  This means the TDD steps write tests against a not-yet-existing module, which is clean red→green.
- The inline `stats()` closure is used by 4 of 6 status branches, making it a natural shared function.
- Completed/steered share 90% of logic (icon color + collapsed text differ); error/aborted share icon+stats structure.
  Keeping each pair in one function avoids wrong-abstraction duplication.
- The `Theme` type in `display.ts` and the `widget-renderer.ts` pattern in `ui/` provide a proven template for pure rendering modules — the new module follows the same shape.
- Dependency #164 (domain directory reorganization) is already merged, so file paths use the `tools/` subdirectory.
