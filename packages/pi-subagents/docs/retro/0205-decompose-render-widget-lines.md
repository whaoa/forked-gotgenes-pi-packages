---
issue: 205
issue_title: "Decompose renderWidgetLines (cognitive 44)"
---

# Retro: #205 — Decompose renderWidgetLines

## Stage: Planning (2026-05-25T15:27:45Z)

### Session summary

Planned the decomposition of `renderWidgetLines` (cognitive complexity 44) into four private helper functions: `categorizeAgents`, `buildSections`, `assembleWithinBudget`, and `assembleOverflow`.
Also updated `architecture.md` Phase 12 steps with issue links (#205–#208) and added a Phase 12 row to the structural refactoring issues table.

### Observations

- The function's complexity comes from five interwoven concerns (categorization, section building, heading, non-overflow assembly with connector fixup, overflow-budget assembly) — but the extraction is mechanical since all logic is already pure and stateless.
- No new tests are needed — the existing 8 tests in `widget-renderer.test.ts` cover all branches end-to-end and remain the correct test level for assembly logic.
- The tree-connector fixup (swapping `├─` → `└─` via string replacement on Unicode chars) is the most fragile part; it stays as-is inside `assembleWithinBudget` rather than being further decomposed.
- A `sections` return object from `buildSections` bundles `finishedLines`, `runningLines`, and `queuedLine` to avoid long parameter lists on the assembly helpers.
