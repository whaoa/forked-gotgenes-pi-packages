---
issue: 195
issue_title: "Convert tool factories to classes"
---

# Retro: #195 — Convert tool factories to classes

## Stage: Planning (2026-05-24T12:00:00Z)

### Session summary

Produced a 5-step TDD plan converting `createAgentTool`, `createGetResultTool`, and `createSteerTool` to classes with constructor-injected dependencies.
Verified both prerequisites (#193, #194) are closed and their effects visible in the current source.
Designed narrow interfaces (`AgentToolRuntime`, `GetResultToolManager`, `SteerToolManager`, `SteerToolEvents`, etc.) that `SubagentRuntime`, `AgentManager`, and `NotificationManager` satisfy structurally.

### Observations

- The conversion is mechanical — no behavioral changes, just structural.
  Existing tests cover all paths; only test helpers need updating.
- `steerAgent` and `getAgentConversation` are pure functions that can be imported directly by the classes rather than injected — simplifies the constructor signature.
- `agentDir` doesn't fit neatly on any existing collaborator, so it remains a constructor param for `AgentTool`.
- The `AgentToolWidget` interface may become redundant once `AgentToolRuntime` replaces it as the type passed to `spawnBackground`/`runForeground`, but this is deferred to implementation.
- Ordered TDD steps from smallest (SteerTool) to largest (AgentTool) to build confidence incrementally.
