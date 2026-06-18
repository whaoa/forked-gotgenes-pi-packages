---
issue: 424
issue_title: "pi-subagents: drop the widget and activity-map dependencies from the subagent tool"
---

# Retro: #424 — pi-subagents: drop the widget and activity-map dependencies from the subagent tool

## Stage: Planning (2026-06-18T15:01:42Z)

### Session summary

Planned Phase 18 Step 5: dropping the `widget` constructor dependency from `AgentTool` and shedding the widget stub from `createToolDeps`.
Verified against current `main` that the `agentActivity` / activity-map dependency named in the issue and roadmap was already removed in Phase 18 Step 3 ([#422]) — only `widget` remains to drop, so the plan corrects that stale wording.
Produced `docs/plans/0424-drop-widget-dep-from-subagent-tool.md` and committed it.

### Observations

- The issue body and the architecture roadmap's Step 5 entry both still say `agentActivity`, but `grep` found no live `agentActivity`/`AgentActivity` references in `src/` — the only hit is a comment in `test/lifecycle/usage.test.ts`.
  Flagged the roadmap Step 5 description for a stale-wording fix during implementation.
- This is a purely subtractive, non-breaking refactor: `AgentTool` is internal (public exports are only the service and settings entries), and `ToolStartHandler` already captures UICtx on every `tool_execution_start`, which fires before any tool's `execute`.
  So removing the tool's own `setUICtx` call loses no behavior — `test/handlers/tool-start.test.ts` already pins UICtx capture on its true owner.
- Folded all edits into one refactor commit because removing the constructor parameter breaks the `index.ts:152` call site, the `make-deps.ts` fixture, and `agent-tool.test.ts` at typecheck time — they cannot land separately.
- Two obsolete tests to remove: `agent-tool.test.ts` → `"sets UI context on runtime at start of execute"` and `make-deps.test.ts` → `describe("widget defaults")`.
  The `UICtx` type itself stays (used by `agent-widget.ts`, `tool-start.ts`, and the widget test) — only the `UICtx` import in `agent-tool.ts` and the `AgentToolWidget` interface go.
- Skipped the `ask-user` gate: operator-authored issue (`gotgenes`), unambiguous proposed change following an established roadmap, clearly non-breaking.

[#422]: https://github.com/gotgenes/pi-packages/issues/422
