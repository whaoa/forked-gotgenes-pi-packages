---
issue: 207
issue_title: "Decompose update in agent-widget.ts (cognitive 31)"
---

# Decompose `update` in `agent-widget.ts`

## Problem Statement

`update` in `ui/agent-widget.ts` has cognitive complexity 31 (CRITICAL per fallow health).
It mixes timer lifecycle decisions, agent state categorization, widget registration/unregistration, status bar management, and stale-entry cleanup in a single 70-line method.
Phase 12, Step 3 targets cognitive complexity < 10 per function.

## Goals

- Extract `assembleWidgetState` as a pure, exported function (agent list → render-ready state) that is directly unit-testable.
- Extract `clearWidget` method to encapsulate the "nothing to show" teardown path (unregister widget, clear status, stop timer, clean stale entries).
- Extract `updateStatusBar` method to encapsulate status text computation and conditional update.
- Simplify `update` to a thin orchestrator: guard → assemble → if idle clear → else update status + register.
- Eliminate duplicated clear logic between `update`'s idle path and `dispose`.

## Non-Goals

- Decomposing `renderWidgetLines` (#205), `showAgentDetail` (#206), or shared test fixtures (#208) — sibling Phase 12 steps.
- Extracting a separate timer-manager class — the timer lifecycle (start via `ensureTimer`, stop via `clearWidget`) is simple enough for inline methods.
- Changing the widget's visual output, status bar format, registration timing, or timer interval.
- Narrowing `AgentManager` dependency to an interface — tracked separately in the architecture doc.
- Adding end-to-end tests for `AgentWidget` — the widget depends on the Pi TUI context and is not unit-testable in isolation.

## Background

`agent-widget.ts` was substantially decomposed in #148 (Phase 9, Step P), which extracted pure rendering functions into `widget-renderer.ts`.
The widget shrank from 374 to ~198 lines.
`update` remained as a 70-line orchestrator with five interwoven concerns:

1. **Guard** — early return when `uiCtx` is not yet set.
2. **Agent state categorization** — counting running/queued/finished agents from `listAgents()`.
3. **Clear path** — unregistering widget, clearing status, stopping the timer, cleaning stale `finishedTurnAge` entries.
4. **Status bar update** — computing status text from running/queued counts and conditionally calling `setStatus`.
5. **Widget lifecycle** — incrementing `widgetFrame`, registering the widget factory on first use, calling `requestRender()` on subsequent ticks.

Concerns 3–4 are interleaved with concern 2 (the counts computed in concern 2 are consumed by concerns 3–4), but each has a distinct responsibility.
Concern 3 also has duplicated logic with `dispose()`.

The `shouldShowFinished` callback reads `this.finishedTurnAge` (instance state), so `assembleWidgetState` accepts it as an injected callback — the function stays pure while the widget retains ownership of the aging Map.

No existing tests cover `AgentWidget` methods — `test/widget-renderer.test.ts` covers the rendering layer extracted in #148.

### Complexity sources

`update` (cognitive 31):

1. Agent counting loop with 3-branch if/else (status checks + `shouldShowFinished`).
2. Conditional widget clear path (nested checks for `widgetRegistered`, `lastStatusText`, `widgetInterval`, + a loop).
3. Status text computation with 2-branch early return and string construction.
4. Conditional status update (`newStatusText !== this.lastStatusText`).
5. Widget registration dispatch (first-time vs. subsequent render, with factory callback registration).

## Design Overview

### `assembleWidgetState` (exported, pure)

```typescript
export interface WidgetState {
  readonly runningCount: number;
  readonly queuedCount: number;
  readonly hasFinished: boolean;
  readonly hasActive: boolean;
}

export function assembleWidgetState(
  agents: readonly WidgetAgent[],
  shouldShowFinished: (agentId: string, status: string) => boolean,
): WidgetState
```

Pure function — counts agents by status.
Returns boolean flags (`hasFinished`, `hasActive`) that drive the widget's register/clear decision.
Does not access `this`, no IO, no side effects.
Exported for direct unit testing.

### `clearWidget` (method)

Encapsulates the "nothing to show" teardown:

- Unregister widget via `setWidget("agents", undefined)` if `widgetRegistered`.
- Clear status via `setStatus("subagents", undefined)` if `lastStatusText` is set.
- Stop timer via `clearInterval` if `widgetInterval` is running.
- Reset all lifecycle flags (`widgetRegistered`, `tui`, `lastStatusText`, `widgetInterval`).
- Clean stale `finishedTurnAge` entries (agents no longer in the current `allAgents` list).

The stale-entry cleanup needs `allAgents` — it accepts the agent list as a parameter.

`dispose()` delegates to `clearWidget()` to eliminate the duplicated clear logic.

### `updateStatusBar` (method)

Encapsulates the status text concern:

- Compute status text from `runningCount` / `queuedCount` (or use undefined when nothing is active).
- Call `setStatus("subagents", text)` only when text differs from `lastStatusText`.
- Cache the new value in `lastStatusText`.

### After refactoring

```typescript
update() {
    if (!this.uiCtx) return;

    const allAgents = this.manager.listAgents();
    const state = assembleWidgetState(allAgents, (id, status) => this.shouldShowFinished(id, status));

    if (!state.hasActive && !state.hasFinished) {
      this.clearWidget(allAgents);
      return;
    }

    this.updateStatusBar(state);
    this.widgetFrame++;

    if (!this.widgetRegistered) {
      this.uiCtx.setWidget("agents", (tui, theme) => {
        this.tui = tui;
        return {
          render: () => this.renderWidget(tui, theme),
          invalidate: () => {
            this.widgetRegistered = false;
            this.tui = undefined;
          },
        };
      }, { placement: "aboveEditor" });
      this.widgetRegistered = true;
    } else {
      this.tui?.requestRender();
    }
  }
```

Cognitive complexity: ~4 (one guard early return + one if/else branch + flat registration dispatch with no nesting).

### `dispose()` delegation

```typescript
dispose() {
    this.clearWidget(this.manager.listAgents());
    // clearWidget already unregisters widget, clears status, stops timer,
    // and resets all lifecycle flags.
  }
```

`dispose` no longer duplicates `clearWidget`'s logic.

### Verification

Call site remains the same — `new AgentWidget(manager, runtime.agentActivity, registry)` in `index.ts` and delegation methods in `runtime.ts` are unchanged.

## Module-Level Changes

### Changed: `src/ui/agent-widget.ts`

- Add exported `WidgetState` interface.
- Add exported `assembleWidgetState(agents, shouldShowFinished)` — pure function extracted from `update`.
- Add `clearWidget(allAgents)` method — extracted from `update`'s idle path.
- Add `updateStatusBar(state)` method — extracted from `update`'s status bar logic.
- Simplify `update` to orchestrate: guard → assemble → if idle clear → else update status + register.
- Simplify `dispose` to delegate to `clearWidget` (removes duplicated clear logic).

No exports are removed or renamed.
The public API (`AgentWidget` class with `setUICtx`, `onTurnStart`, `ensureTimer`, `markFinished`, `update`, `dispose`) is unchanged.
`UICtx` type stays exported.

### Changed: `test/widget-renderer.test.ts`

No changes — this test file covers `widget-renderer.ts` functions, not `agent-widget.ts`.

### Changed: `docs/architecture/architecture.md`

- Update the complexity hotspots table: `update` drops from 21/31 to ~4/<10.

## Test Impact Analysis

1. **New tests enabled:** Direct unit tests for `assembleWidgetState` — a pure function with agent status combinations.
   Previously untestable because the logic was embedded in `update`'s UI-dependent flow.
   Tests cover: running-only, queued-only, finished, mixed states, empty list, shouldShowFinished filtering.
2. **No existing tests become redundant** — there are currently no tests for `AgentWidget`.
3. **No existing tests must change** — `test/widget-renderer.test.ts` (395 lines, 23 tests) exercises the renderer layer and is unaffected by agent-widget internal refactoring.

## TDD Order

1. **Red → Green:** Add `assembleWidgetState` as a module-level exported pure function with unit tests for all agent status combinations.
   Implement `assembleWidgetState` to make tests pass.
   Commit: `feat: extract assembleWidgetState from agent-widget update`

2. **Green → Refactor:** Wire `update` to use `assembleWidgetState`.
   Extract `clearWidget(allAgents)` method from the idle path.
   Extract `updateStatusBar(state)` method from the status bar logic.
   Delegate `dispose` to `clearWidget`.
   All existing tests pass (no behavior change, no export changes).
   Commit: `refactor: decompose update into assembleWidgetState, clearWidget, and updateStatusBar`

3. **Verify:** Run `pnpm run check` and `pnpm vitest run test/widget-renderer.test.ts` to confirm no regressions.
   Commit: n/a (verification only).

## Risks and Mitigations

| Risk                                                                                | Mitigation                                                                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `assembleWidgetState` has overlapping categorization logic with `categorizeAgents`  | `categorizeAgents` returns full arrays for rendering; `assembleWidgetState` returns lightweight counts.           |
| in `widget-renderer.ts`.                                                            | Different outputs for different consumers — no duplication concern.                                               |
| `clearWidget` is called from both `update` and `dispose` — must be safe at shutdown | `clearWidget` checks `this.uiCtx` and `this.widgetInterval` before accessing them; identical to current `dispose` |
|                                                                                     | guards.                                                                                                           |
| No existing tests for `AgentWidget` — refactoring risks are higher                  | The pure function `assembleWidgetState` is tested directly.                                                       |
|                                                                                     | The rest is a mechanical extraction with no semantic change — type checker verifies structural integrity.         |
| `dispose` now calls `listAgents()` to pass `allAgents` to `clearWidget`             | `listAgents()` is already called by `update` and the test that exercises `dispose` does not mock `listAgents`     |
|                                                                                     | returning anything observable — no behavioral change.                                                             |

## Open Questions

None — the decomposition is a mechanical extraction of existing code into named functions and methods, following the pattern established by Phase 12 Steps 1 and 2.
