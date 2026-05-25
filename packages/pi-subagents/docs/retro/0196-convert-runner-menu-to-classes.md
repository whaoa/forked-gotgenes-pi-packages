---
issue: 196
issue_title: "Convert AgentRunner and AgentsMenuHandler to classes, simplify index.ts"
---

# Retro: #196 — Convert AgentRunner and AgentsMenuHandler to classes, simplify index.ts

## Stage: Planning (2026-05-25T14:35:46Z)

### Session summary

Produced a 6-step TDD plan covering the final two closure-factory-to-class conversions (`createAgentRunner` → `ConcreteAgentRunner`, `createAgentsMenuHandler` → `AgentsMenuHandler`) and the subsequent `index.ts` simplification.
Confirmed that `AgentManager` structurally satisfies `AgentMenuManager`, enabling direct pass-through without adapter closures.

### Observations

- The issue's proposed `AgentsMenuHandler` constructor omits `agentActivity`, but the class needs it for `viewAgentConversation`.
  Plan includes it as a constructor param — minimal deviation from the issue.
- `getModelLabel` can be internalized into `AgentsMenuHandler` since it only uses two pure imported functions (`resolveModel`, `getModelLabelFromConfig`) plus the registry (already a constructor param).
  This eliminates a 7-line closure from `index.ts`.
- Tests for `agent-runner` call `runAgent`/`resumeAgent` directly — no test uses `createAgentRunner`, so the runner conversion has zero test impact.
- The `agent-menu.test.ts` file is 215 lines and needs call-site updates (factory → class constructor + `.handle()`), but no logic changes.
- After both conversions, `index.ts` loses ~5 imports and ~4 adapter closures.
  The remaining ~15 closures are structural (event registrations, SDK factory callbacks) and cannot be eliminated.
