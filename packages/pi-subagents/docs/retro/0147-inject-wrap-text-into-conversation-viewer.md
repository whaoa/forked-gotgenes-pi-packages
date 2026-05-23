---
issue: 147
issue_title: "Inject text wrapping into ConversationViewer (Phase 9, Step O)"
---

# Retro: #147 — Inject text wrapping into ConversationViewer (Phase 9, Step O)

## Stage: Planning (2026-05-23T00:00:00Z)

### Session summary

Read the issue, loaded package-pi-subagents, code-design, testing, and markdown-conventions skills.
Explored `src/ui/conversation-viewer.ts`, `src/ui/agent-menu.ts`, `test/conversation-viewer.test.ts`, and the Phase 9 architecture roadmap.
Wrote and committed the plan at `packages/pi-subagents/docs/plans/0147-inject-wrap-text-into-conversation-viewer.md`.

### Observations

- The change is tightly scoped: two source files (`conversation-viewer.ts`, `agent-menu.ts`) and one test file.
- `wrapTextWithAnsi` is called in exactly four places inside `buildContentLines` — all in the same private method, making the replacement straightforward.
- The only production call site for `new ConversationViewer({…})` is `viewAgentConversation` in `agent-menu.ts`.
  `wrapTextWithAnsi` is added as a static import there and passed as `wrapText` — no threading through `AgentMenuDeps` needed.
- All `new ConversationViewer({…})` calls in the test file are inline (no shared factory helper), so every call site needs the new `wrapText` field added.
  Grep confirms the count: 11+ calls, all in `test/conversation-viewer.test.ts`.
- The plan uses 2 TDD cycles: Cycle 1 adds the field and updates all call sites (with the `vi.mock` still present for safety); Cycle 2 removes the mock and converts dynamic `await import()` to static imports.
  This ordering avoids a large simultaneous change and gives the suite a stable intermediate state.
- The "mock is intercepting wrapTextWithAnsi" test is deleted in Cycle 1 (it verified the mock mechanism, not production behavior).
- No exported API symbols are removed; `wrapText` is a new required field on `ConversationViewerOptions`, which is a breaking change only for external constructors of `ConversationViewer` — confirmed none exist outside this package.
