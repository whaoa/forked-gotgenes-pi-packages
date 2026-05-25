---
issue: 193
issue_title: "SubagentRuntime owns context queries"
---

# Retro: #193 — SubagentRuntime owns context queries

## Stage: Planning (2026-05-24T21:00:00Z)

### Session summary

Planned the Layer 1 change that types `SubagentRuntime.currentCtx` as `SessionContext`, adds three query methods (`buildSnapshot`, `getModelInfo`, `getSessionInfo`), and eliminates 4 `as any` casts from `index.ts`.
The plan covers 7 TDD steps touching `runtime.ts`, `handlers/lifecycle.ts`, `parent-snapshot.ts`, `context.ts`, `service-adapter.ts`, and `index.ts`.

### Observations

- The `pi` field in `currentCtx` is never read back — only stored.
  Dropping it is safe; `SessionLifecycleHandler` already holds `pi` as a constructor param.
- `ExtensionContext` structurally satisfies `SessionContext`, so changing `buildParentSnapshot`'s param type is source-compatible with the `/agents` command handler that passes raw SDK `ctx`.
- `service-adapter.ts` gets the biggest structural change: its two closure params (`getCtx`, `getModelRegistry`) collapse into a single `ServiceRuntimeLike` interface.
- No design ambiguity — the architecture doc's Layer 1 spec and the issue body are fully aligned.
- Test fixtures in `make-deps.ts` are unaffected because the `AgentToolDeps` interface shape doesn't change — only the wiring in `index.ts` that supplies the implementations changes.
