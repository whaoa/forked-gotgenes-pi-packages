# Architecture

This document describes the architecture of the pi-subagents fork: a focused, composable core with a stable API boundary that other extensions can build on.

## Design principles

1. **Narrow core** — the extension owns agent spawning, execution, and result retrieval.
   Everything else is a consumer.
2. **Composable by default** — other extensions can spawn agents, observe their lifecycle, and display their state without importing this package directly.
3. **Typed API boundary** — this package exports a `SubagentsService` interface and `Symbol.for()` accessors (`publishSubagentsService` / `getSubagentsService`).
   Consumers declare this package as an optional peer dependency and use dynamic import for compile-time types.
   The runtime bridge is `Symbol.for("@gotgenes/pi-subagents:service")` on `globalThis` — no separate API package.
4. **No scheduling** — in-process scheduling is removed from the core.
   Scheduling is a separate concern that any extension can implement by calling `spawn()` on the published API.
5. **UI extraction is deferred** — the widget, conversation viewer, and `/agents` command menu stay in the core for now.
   They are the first candidate for extraction once the API boundary is proven stable.
6. **Snapshot, don't capture** — mutable parent state (ctx, session, model) is read once at spawn time and frozen into a plain data object.
   No live references survive past the spawn call.
7. **Subscribe, don't thread** — observation of agent progress uses event subscription on the session, not callback parameters threaded through multiple layers.

## Current state

The extension is ~6,100 LOC across 35 focused modules with a typed `SubagentsService` API boundary.
The `index.ts` entry point is ~270 lines; the rest is decomposed into domain modules.

```text
index.ts (274 LOC)       — entry point, tool registration, event wiring
agent-manager.ts (499)   — lifecycle, concurrency, queue
agent-runner.ts (512)    — session creation, turn loop, tool filtering
session-config.ts (243)  — pure session-config assembler
agent-types.ts (138)     — type registry (defaults + custom .md files)
types.ts (126)           — shared type definitions
runtime.ts (94)          — SubagentRuntime factory (session-scoped state)

prompts.ts               — system prompt assembly
context.ts               — parent conversation extraction
memory.ts                — persistent MEMORY.md per agent
skill-loader.ts          — preload .pi/skills into prompts
env.ts                   — git/platform detection

worktree.ts              — git worktree isolation
usage.ts                 — token usage tracking
model-resolver.ts        — fuzzy model name resolution
invocation-config.ts     — merge tool params with agent config
session-dir.ts           — subagent session directory derivation
settings.ts              — persistent operational settings

service.ts               — SubagentsService interface + Symbol.for() accessors
service-adapter.ts       — SubagentsService implementation wrapping AgentManager

tools/agent-tool.ts      — Agent tool definition + execute
tools/get-result-tool.ts — get_subagent_result tool
tools/steer-tool.ts      — steer_subagent tool
tools/helpers.ts         — shared tool utilities

handlers/lifecycle.ts    — session_start, session_before_switch, session_shutdown
handlers/tool-start.ts   — tool_execution_start handler

notification.ts          — completion nudges, custom message renderer
renderer.ts              — notification TUI component

ui/agent-widget.ts       — above-editor live status widget
ui/agent-menu.ts         — /agents slash command menu
ui/conversation-viewer.ts — scrollable session overlay

default-agents.ts        — embedded default agent configs (general-purpose, Explore, Plan)
custom-agents.ts         — user-defined agent .md file loader
debug.ts                 — debug logging utility
```

### Coupling today

The widget reads agent state by holding a direct reference to `SubagentRuntime` and polling a shared mutable `Map<string, AgentActivity>` every 80 ms. The conversation viewer subscribes directly to `AgentSession` objects.

Cross-extension consumers use the typed `SubagentsService` API published via `Symbol.for("@gotgenes/pi-subagents:service")` on `globalThis`.
The ad-hoc RPC layer and untyped `Symbol.for("pi-subagents:manager")` have been removed.

## Target state

```text
  ┌────────────────────────────────────────────────────────┐
  │  @gotgenes/pi-subagents  (this package)                 │
  │                                                        │
  │  Exports:                                              │
  │    SubagentsService interface                           │
  │    publishSubagentsService() / getSubagentsService()    │
  │    SubagentRecord, SubagentStatus, LifetimeUsage types  │
  │    SUBAGENT_EVENTS constants                            │
  │                                                        │
  │  Core:                                                 │
  │    Agent + get_subagent_result + steer_subagent tools  │
  │    AgentManager, agent-runner, agent-types             │
  │    publishSubagentsService(impl)  ← called at init     │
  │                                                        │
  │  Internal UI (widget, viewer, /agents menu)            │
  │  ← moves to pi-subagents-ui later                     │
  └──────────────────────┬─────────────────────────────────┘
                         │ Symbol.for("@gotgenes/pi-subagents:service")
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────────┐
  │ pi-     │    │ pi-subagents │    │ any future   │
  │ schedule│    │ -ui          │    │ extension    │
  │ (other  │    │ (deferred)   │    │              │
  │  ext)   │    └──────────────┘    └──────────────┘
  └─────────┘
       │
       │  getSubagentsService()?.spawn(...)
       │  (optional peer dep + dynamic import for types)
       ▼
```

### What the core owns

- The three tools: `Agent`, `get_subagent_result`, `steer_subagent`.
- `AgentManager` — spawn, queue, abort, resume, concurrency control.
- `agent-runner` — session creation, turn loop, tool filtering, extension binding (Patches 2 and 3).
- `session-config` — pure configuration assembler (extracted from `agent-runner`).
- `SubagentRuntime` — session-scoped state bag with methods.
- Agent type registry — default agents, custom `.md` file loading.
- Prompt assembly, context extraction, memory, skills, environment.
- Worktree isolation.
- Token usage tracking.
- Session directory derivation and persisted `SessionManager` for subagent transcripts.
- Settings persistence.
- Internal UI (widget, conversation viewer, `/agents` menu) — these stay until the API boundary is proven, then move to a separate extension.

### What the core drops

- **Scheduling** (`schedule.ts`, `schedule-store.ts`, `ui/schedule-menu.ts`) — 612 LOC removed.
  The `schedule` parameter is removed from the `Agent` tool schema.
  Any extension that wants scheduling can implement it by calling `getSubagentsService()?.spawn(...)` on a timer.
- **Ad-hoc RPC** (`cross-extension-rpc.ts`) — replaced by the typed `SubagentsService` published via `Symbol.for()`.
  The untyped event-bus RPC channels are removed.
- **Group join** (`group-join.ts`) — 141 LOC removed.
  The grouped notification batching adds complexity for a marginal UX improvement.
  Individual completion notifications are sufficient.
- **Output file** (`output-file.ts`) — replaced by `session-dir.ts` + `SessionManager.create()` (#61).
  Subagent transcripts are now written in Pi's official JSONL session format via the SDK's `SessionManager`, nested under the parent session directory.

### Estimated impact (realized)

| Subsystem              | Status         | LOC impact                                 |
| ---------------------- | -------------- | ------------------------------------------ |
| Scheduling             | Removed (#52)  | −612                                       |
| Ad-hoc RPC             | Removed (#49)  | −080                                       |
| Group join             | Removed (#49)  | −141                                       |
| Output file            | Replaced (#61) | −83 (replaced by 38-line `session-dir.ts`) |
| index.ts decomposition | Done (#54)     | 1,894 → 274                                |

The codebase is now ~6,100 LOC across 35 modules.
The `index.ts` entry point is 274 lines.

## SubagentsService (done — #48)

The `SubagentsService` interface, accessor functions, and serializable types are exported from `@gotgenes/pi-subagents` via the `./service` export map entry.
No separate API package is needed.

Consumers declare this package as an optional peer dependency:

```json
{
  "peerDependencies": {
    "@gotgenes/pi-subagents": ">=5.0.0"
  },
  "peerDependenciesMeta": {
    "@gotgenes/pi-subagents": { "optional": true }
  }
}
```

At runtime, consumers use dynamic import for type-safe access to the accessor functions:

```typescript
const { getSubagentsService } = await import("@gotgenes/pi-subagents");
const svc = getSubagentsService();
if (svc) {
  svc.spawn("Explore", "Check for stale TODOs");
}
```

Pi's extension loader creates a fresh `jiti` instance per extension with `moduleCache: false`, so module-scoped singletons don't survive across extensions.
The accessor functions use `Symbol.for("@gotgenes/pi-subagents:service")` on `globalThis`, which is process-global by spec, to bridge this gap.
The dynamic import provides compile-time types; the `Symbol.for()` key is the actual runtime channel.

### Interface

See `src/service.ts` for the canonical definition.
Key types:

- `SubagentsService` — `spawn`, `getRecord`, `listAgents`, `abort`, `steer`, `waitForAll`, `hasRunning`.
- `SubagentRecord` — serializable agent snapshot (no live session objects).
- `SpawnOptions` — `description`, `model`, `maxTurns`, `thinkingLevel`, `isolated`, `inheritContext`, `foreground`, `bypassQueue`, `isolation`.
- `SUBAGENT_EVENTS` — channel constants for `pi.events` subscriptions.

### Accessor pattern

```typescript
const SERVICE_KEY = Symbol.for("@gotgenes/pi-subagents:service");

export function publishSubagentsService(service: SubagentsService): void {
  (globalThis as Record<symbol, unknown>)[SERVICE_KEY] = service;
}

export function getSubagentsService(): SubagentsService | undefined {
  return (globalThis as Record<symbol, unknown>)[SERVICE_KEY] as
    | SubagentsService
    | undefined;
}
```

If Pi gains a native service registry ([earendil-works/pi#4207]), these accessors can be updated to delegate to `pi.registerService()` / `pi.getService()` internally while keeping the same consumer API.

### Lifecycle events

The core emits events on `pi.events` that any extension can observe:

| Channel               | Payload                                     | When                 |
| --------------------- | ------------------------------------------- | -------------------- |
| `subagents:started`   | `{ id, type, description }`                 | Agent begins running |
| `subagents:completed` | `{ id, type, status, result?, error? }`     | Agent finishes       |
| `subagents:activity`  | `{ id, toolName?, textDelta?, turnCount? }` | Streaming progress   |

These replace the ad-hoc RPC channels.
They are fire-and-forget broadcast events — no request IDs, no reply channels.

### Consumer example: scheduling extension

```typescript
export default function (pi) {
  pi.on("session_start", async (event, ctx) => {
    let getSubagentsService;
    try {
      ({ getSubagentsService } = await import("@gotgenes/pi-subagents"));
    } catch {
      return; // pi-subagents not installed
    }
    const svc = getSubagentsService();
    if (!svc) return;

    setInterval(() => {
      svc.spawn("Explore", "Check for stale TODOs", {
        bypassQueue: true,
      });
    }, 60 * 60 * 1000);
  });
}
```

### Consumer example: transcript extension

```typescript
export default function (pi) {
  pi.events.on("subagents:completed", async (data) => {
    const { id } = data as { id: string };
    let getSubagentsService;
    try {
      ({ getSubagentsService } = await import("@gotgenes/pi-subagents"));
    } catch {
      return;
    }
    const record = getSubagentsService()?.getRecord(id);
    if (record?.result) {
      fs.appendFileSync("agent-log.jsonl", JSON.stringify(record) + "\n");
    }
  });
}
```

## index.ts decomposition (done — #54, #69, #70)

The original 1,894-line `index.ts` has been decomposed into focused modules:

```text
src/
├── index.ts (274)            ← slimmed entry point: init, tool registration
├── runtime.ts (94)           ← SubagentRuntime: session-scoped state + methods
├── tools/
│   ├── agent-tool.ts (626)   ← Agent tool definition + execute
│   ├── get-result-tool.ts    ← get_subagent_result tool
│   ├── steer-tool.ts         ← steer_subagent tool
│   └── helpers.ts            ← shared tool utilities
├── handlers/
│   ├── lifecycle.ts          ← session_start, session_before_switch, session_shutdown
│   └── tool-start.ts         ← tool_execution_start handler
├── notification.ts           ← completion nudges, custom renderer
├── renderer.ts               ← notification TUI component
├── ui/agent-menu.ts (677)    ← /agents slash command menu
├── service-adapter.ts        ← SubagentsService implementation wrapping AgentManager
└── (existing domain modules unchanged)
```

Each extracted module receives narrow constructor-injected dependencies rather than closing over module-level state.
Handlers call methods on narrow runtime interfaces — no raw field writes, no `widget!` reach-throughs.

## Phase plan (Phases 1–5 complete)

### Phase 1: Export `SubagentsService` from this package ✓ (done — #48)

Added the `SubagentsService` interface, serializable types, `Symbol.for()` accessor functions, and `SUBAGENT_EVENTS` constants as public exports.
Wired `service-adapter.ts` to wrap `AgentManager` and call `publishSubagentsService()` at extension init.

### Phase 2: Remove scheduling ✓ (done — issue #52)

Deleted `schedule.ts`, `schedule-store.ts`, `ui/schedule-menu.ts`.
Removed the `schedule` parameter from the `Agent` tool schema.
Removed scheduler setup and lifecycle hooks from `index.ts`.

### Phase 3: Remove group-join, ad-hoc RPC; replace output-file ✓ (done — #49, #61)

Deleted `group-join.ts`, `cross-extension-rpc.ts` (#49).
Replaced `output-file.ts` with `SessionManager.create()` + `session-dir.ts` (#61).
Simplified `index.ts` to use direct individual notifications.
Lifecycle events emitted on `pi.events` for external consumers.

### Phase 4: Implement and publish `SubagentsService` ✓ (done — #48)

Wired `service-adapter.ts` to wrap `AgentManager` and call `publishSubagentsService()` at extension init.
Model strings are resolved inside the adapter.

### Phase 5: Decompose `index.ts` ✓ (done — #54, #69, #70, #87)

Extracted tools, notifications, activity tracking, event handlers, and the `/agents` command into separate modules.
Created `SubagentRuntime` factory to hold session-scoped state.
`src/index.ts` shrank from ~1,894 lines to ~274 lines.

### Phase 6 (future): Extract UI to `@gotgenes/pi-subagents-ui`

Move `ui/agent-widget.ts`, `ui/conversation-viewer.ts`, the `/agents` command, notifications, and activity tracking to a separate extension that consumes `SubagentsService` + lifecycle events.
This phase is deferred until the API boundary is proven stable in production.

## Structural refactoring roadmap (post-#54) ✓ complete

All structural refactoring phases are complete.
See `git log` for the full history; issue references are preserved below for traceability.

| Phase              | Issue              | Summary                                                               |
| ------------------ | ------------------ | --------------------------------------------------------------------- |
| Foundation         | #69, #71, #76, #80 | SubagentRuntime, pure assembler, cwd injection, config consolidation  |
| Core decomposition | #84, #72, #87, #70 | WorktreeManager, AgentManager DI, runtime methods, handler extraction |
| Interface polish   | #66, #77           | SDK types, projectAgentsDir                                           |
| Features           | #61                | JSONL session transcripts                                             |

The remaining open issue is #22 (parent-session resolution), a cross-extension track that does not gate the structural work.

---

## Next target: AgentManager internal decomposition

The structural refactoring roadmap decomposed the extension entry point and established clean module boundaries.
AgentManager itself — the central class — was not touched structurally.
A design review reveals three tangled responsibilities and two systemic patterns that inflate complexity.

### Problem statement

AgentManager is a 500-line class that serves as the single mediator between tool callers and the agent runner.
Every concern passes through it because it owns the `AgentRecord`.

Three responsibilities are tangled:

1. **Record registry** — create, track, query, clean up `AgentRecord` instances.
2. **Concurrency control** — queue, running count, drain, `bypassQueue`.
3. **Execution orchestration** — thread options to the runner, intercept callbacks to update records, wire abort signals, manage worktree lifecycle.

`startAgent()` alone is ~130 lines because it handles all three.
The `.then()` / `.catch()` blocks mix status updates (job 1), worktree cleanup (job 3), notification callbacks (job 1), and queue draining (job 2).

Two systemic patterns compound the problem:

### Problem 1: Callback threading

`SpawnOptions` carries 6 `on*` callback fields.
They thread through three layers:

```text
agent-tool.ts (UI tracking state)
  → AgentManager.startAgent() wraps each to update the record, then forwards
    → runner.run() subscribes to session events, calls callbacks
```

The callbacks serve two purposes that are tangled together:

1. **Record statistics** — `onToolActivity` increments `toolUses`, `onAssistantUsage` accumulates `lifetimeUsage`, `onCompaction` increments `compactionCount`, `onSessionCreated` captures the session and output file.
   This is internal bookkeeping that belongs to the record.
2. **UI streaming** — the same callbacks update the widget's active-tool display, response text preview, and turn counter.
   This is presentation that belongs to the UI layer.

The session already emits all of these events via `session.subscribe()`.
The runner subscribes to session events, translates them into callback invocations, AgentManager wraps each callback to update the record, then forwards to the caller's callback.
Three layers reimplementing what a single event subscription could provide.

### Problem 2: Live `ctx` capture

`ctx: ExtensionContext` is a mutable reference to the parent session.
It is captured into `SpawnArgs` and held in the concurrency queue:

```typescript
const args: SpawnArgs = { pi, ctx, type, prompt, options };
this.queue.push({ id, args });  // ctx held until dequeue
```

When the queued agent dequeues, `runAgent()` reads from the live `ctx`:

- `ctx.cwd` — directory that may have changed.
- `ctx.getSystemPrompt()` — live method call on a potentially stale session.
- `ctx.model` — model that may have been switched.
- `ctx.modelRegistry` — registry reference.

If the parent session changes between queue and dequeue (model switch, cwd change, session restart), the agent reads invalid state.
The same live reference persists in `runtime.currentCtx` for the service-adapter.

Additionally, `inheritContext` calls `ctx.sessionManager.getBranch()` at run time.
The user's intent is to fork the conversation as it existed when they asked for the agent — not the conversation at some arbitrary later point when a queue slot opens.

### Design: snapshot at spawn time

Replace the live `ctx` capture with a plain data snapshot taken once at spawn time:

```typescript
interface ParentSnapshot {
  cwd: string;
  systemPrompt: string;
  model: unknown;
  modelRegistry: { find(...): unknown; getAvailable?(): ... };
  parentContext?: string;  // pre-built text if inheritContext
}
```

This snapshot is:

- Captured once in `spawn()` (or by the tool before calling `spawn()`).
- Stored in `SpawnArgs` instead of `ctx`.
- Passed to `runner.run()` instead of `ctx: ExtensionContext`.
- Immutable — no staleness risk, no session-lifetime coupling.

`runAgent()` already reads exactly these 4 values from `ctx` and never touches it again.
`buildParentContext()` also reads once and produces a string.
The snapshot formalizes what is already happening, and makes the "read once" guarantee structural.

### Design: session-event observation replaces callback threading

The session emits events via `session.subscribe()`.
Today, `runner.run()` subscribes and translates events into `RunOptions.on*()` callbacks, AgentManager wraps those to update the record, then forwards to the caller.

The target replaces this three-layer chain with direct subscription:

```text
                     session.subscribe()
                            │
              ┌─────────────┼─────────────┐
              │                           │
       Record observer              UI observer
  (accumulates stats on record)   (updates widget state)
  managed by AgentManager         managed by agent-tool
  subscribes in startAgent()      subscribes after spawn
```

AgentManager subscribes to the session to update the record (toolUses, lifetimeUsage, compactionCount, outputFile).
The agent-tool subscribes to the session to stream UI state (active tools, response text, turn count).
Neither layer wraps or forwards the other's callbacks.

`RunOptions` drops all 6 `on*` fields and becomes pure configuration.
`SpawnOptions` drops all 6 `on*` fields and becomes identity + dispatch mode.
The session reference reaches callers via `record.session` (already stored) or via an `onSessionCreated` callback that is the one callback that remains (it delivers the session object, enabling the external subscription).

### Design: record state machine

Status transitions are scattered across 6 locations (`startAgent` `.then()`, `.catch()`, `resume()`, `abort()`, `abortAll()`, `drainQueue()`).
Each location sets `record.status` plus associated fields (`completedAt`, `result`, `error`) in ad-hoc combinations.

Extract a state machine on `AgentRecord` (or a thin wrapper) that owns all transitions:

```typescript
record.markRunning(startedAt)
record.markCompleted(result, completedAt)
record.markError(error)
record.markStopped()
record.resetForResume()
```

Each method sets exactly the fields that belong to that transition.
Invalid transitions (e.g., `markCompleted` on an already-stopped record) are no-ops.
The `if (record.status !== "stopped")` guards in `.then()` and `.catch()` become part of the transition logic rather than scattered conditionals.

### Phased implementation

The three designs are independent and can land in any order.
The recommended sequence minimizes intermediate churn.

#### Step 1: Record state machine

Extract status-transition methods onto `AgentRecord` (or a `RecordManager` wrapper).
Purely mechanical — replace scattered field writes with method calls.
No interface changes for callers.

This is the lowest-risk change and immediately reduces `startAgent()` line count.

#### Step 2: Parent snapshot

Replace `ctx: ExtensionContext` in `SpawnArgs` with a `ParentSnapshot` data object.
Capture the snapshot in `spawn()` or at the tool call site.
Update `runner.run()` signature to accept `ParentSnapshot` instead of `ctx`.
Remove `pi: ExtensionAPI` from `SpawnArgs` (it is only used to pass to `runner.run()`, which only uses it for `detectEnv()` — that can accept a shell-exec function instead).

This change narrows the `AgentRunner` interface and eliminates live-reference capture.

#### Step 3: Session-event observation

Replace the callback-threading pattern with direct session subscriptions.
AgentManager subscribes to the session after creation to update the record.
The agent-tool subscribes to the session after spawn to stream UI state.
`RunOptions` and `SpawnOptions` drop all `on*` callback fields.

This is the largest change but depends on Step 2 (the runner signature is already narrower) and benefits from Step 1 (the record's transition methods encapsulate the stats updates that the subscription drives).

### Expected outcome

| Metric                            | Before | After                    |
| --------------------------------- | ------ | ------------------------ |
| `SpawnOptions` fields             | 19     | ~8 (identity + dispatch) |
| `RunOptions` fields               | 15     | ~9 (config only)         |
| `startAgent()` lines              | ~130   | ~50                      |
| Callback layers                   | 3      | 0 (direct subscription)  |
| Live `ctx` references in queue    | 1      | 0 (snapshot)             |
| Scattered status-transition sites | 6      | 1 (state machine)        |

---

## Relationship with upstream

This fork (`@gotgenes/pi-subagents` in the [gotgenes/pi-packages] monorepo) is now a hard fork of [tintinweb/pi-subagents].
The decomposition diverges materially from upstream's direction.

The three upstream PRs (#71, #72, #73) remain open.
If they land, upstream gains the peer-dep fix and the two RepOne patches.
This fork continues independently regardless.

Upstream fixes and ideas are cherry-picked when they align with this fork's scope.
The upstream test suite is run periodically as a regression canary for the agent-runner core.

[earendil-works/pi#4207]: https://github.com/earendil-works/pi/issues/4207
[gotgenes/pi-packages]: https://github.com/gotgenes/pi-packages
[tintinweb/pi-subagents]: https://github.com/tintinweb/pi-subagents
