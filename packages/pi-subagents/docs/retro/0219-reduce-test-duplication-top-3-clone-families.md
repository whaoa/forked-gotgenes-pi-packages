---
issue: 219
issue_title: "Reduce test duplication — top 3 clone families (Phase 13, Step 6)"
---

# Retro: #219 — Reduce test duplication — top 3 clone families

## Stage: Planning (2026-05-26T20:00:00Z)

### Session summary

Analyzed duplication patterns in the three target test files (`agent-manager.test.ts`, `conversation-viewer.test.ts`, `agent-config-editor.test.ts`).
Produced a 5-step TDD plan with shared `manager-stubs.ts` helper for runner/worktree factories, plus inline factories for the two UI test files.

### Observations

- The agent-manager test has the most diverse clone families (runner stubs, worktree stubs, run-result shapes) — these benefit from a shared helper file since the patterns are reused across 15+ describe blocks.
- The conversation-viewer and config-editor duplication is more localized — inline factories within each test file are the right granularity to avoid over-extraction.
- Gated runners (using `Promise.withResolvers`) were deliberately kept inline since they encode test-specific flow control that a factory would obscure.
- Both dependencies (#214, #216) are closed, so the production code is stable and the tests won't shift under us during implementation.
