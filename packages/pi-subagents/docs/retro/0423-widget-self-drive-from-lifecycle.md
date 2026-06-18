---
issue: 423
issue_title: "pi-subagents: make the agent widget self-drive from lifecycle events"
---

# Retro: #423 — Make the agent widget self-drive from lifecycle events

## Stage: Planning (2026-06-17T00:00:00Z)

### Session summary

Planned Phase 18 Step 4 of the widget/tool decoupling track: making `AgentWidget` a `SubagentManagerObserver` that self-drives its 80 ms timer from lifecycle notifications, wired via a new `CompositeSubagentObserver` fan-out, and removing all inbound widget calls from the spawn tools.
Wrote a four-step plan (three `refactor:` commits + a `docs:` sweep) at `packages/pi-subagents/docs/plans/0423-widget-self-drive-from-lifecycle.md`.

### Observations

- **Wiring mechanism was the live design decision.**
  `SubagentManager` has a single `observer` slot.
  Three options surfaced: (A) a `CompositeSubagentObserver` fan-out in `index.ts`, (B) make the manager hold an observer list, (C) subscribe the widget to the public `pi.events` channels.
  The operator initially leaned toward B (matching the issue's literal file list) but was unsure; after reframing around the decouple + overridable-UI north star, they chose **A**.
  Rationale recorded in the plan: A keeps the core closed for modification, B moves fan-out *into* the core (wrong direction), and C front-runs the Step 6 ([#425]) public-event-contract reconciliation.
  Key insight that flattened the decision: all three options keep the widget's `manager.listAgents()` reference, so they only change the *trigger*, not the data source — full broadcast-plus-query decoupling is the Step 8 ([#427]) concern.
- **`markFinished` is fully redundant** and is deleted, not relocated: `seedFinishedAgents()` (added in [#421] / [#422]) already seeds any agent with `completedAt` on each poll tick.
  This matters because the manager **never fires `onSubagentCompleted` for foreground agents** (`onRunFinished` guards on `isBackground`), so the widget could not learn of foreground completion via the observer anyway — polling covers it.
- **Construction cycle** (widget needs manager → manager needs observer → observer includes widget) is broken by constructing the composite with `[eventsObserver]`, passing it to the manager, then `observer.add(widget)` after the widget is built; the manager consults the observer only lazily at spawn time.
- **TDD ordering avoids a behavior gap:** Step 2 wires the widget as an observer *while the spawn tools still drive it* (idempotent double-drive), strictly before Step 3 removes the spawn-tool calls — so no commit leaves the widget without a timer-start signal.
  The new widget observer methods need no `fallow-ignore` because they are invoked polymorphically through `SubagentManagerObserver` (the `SubagentEventsObserver` precedent).
- This step narrows `AgentToolWidget` to `setUICtx` only but keeps the `AgentTool` widget constructor param; full removal is Step 5 ([#424]).
- Non-breaking and internal-only (no public service/settings surface touched), so `refactor:`/`docs:` commits, no `BREAKING CHANGE` footer.

## Stage: Implementation — TDD (2026-06-17T10:00:00Z)

### Session summary

Executed the four-step plan exactly as written: added `CompositeSubagentObserver` (Step 1), made `AgentWidget` a `SubagentManagerObserver` and wired the composite in `index.ts` (Step 2), removed all spawn-tool widget wiring and deleted `markFinished` (Step 3), then swept the architecture doc + SKILL.md (Step 4).
Four commits (three `refactor:`, one `docs:`); test count `1032 → 1039` (+7 composite, +4 widget observer, −4 removed spawner/fixture widget-driving tests).
`check`, root `lint`, full `test`, and `fallow dead-code` all green; pre-completion reviewer returned PASS.

### Observations

- **Mid-step correction (not a separate commit):** in Step 2 I initially over-reached by deleting `markFinished` and privatizing `ensureTimer`, which breaks `index.ts` typing because `AgentToolWidget` still required those methods until Step 3.
  Caught it before committing and reverted both to Step 3 per the plan; Step 2 kept them public.
  The plan's ordering (narrow `AgentToolWidget` and delete `markFinished` only in the atomic Step 3 removal) was correct — the lesson is to trust the step boundaries.
- **Biome `useIterableCallbackReturn` false trigger:** naming the composite's private fan-out helper `forEach` made Biome treat the call as `Array.prototype.forEach` and reject the value-returning arrow.
  Renamed it to `dispatch` — a strictly better name anyway.
- **`vi.getTimerCount()` cleanly proves the timer started:** the widget observer tests assert `getTimerCount()` goes `0 → 1` on `onSubagentStarted`/`onSubagentCreated`, distinguishing `startLoop` (ensureTimer + render) from a bare `update()` (render only), with the manager-stub creating no other timers.
- **No dead-code window:** the widget's new observer methods are invoked polymorphically through `SubagentManagerObserver` (the `SubagentEventsObserver` precedent), so `fallow` saw them as used from Step 2 onward; `ensureTimer` became `private` in Step 3, dropping its now-stale `fallow-ignore`.
- **The Step 2 transient double-drive was harmless** as predicted: both the spawn tools and the composite drove the widget in that commit, and every driven method is idempotent — full suite green at that commit.
- **Reviewer notes (non-blocking, both PASS):** a pre-existing "six domains" vs "seven domains" inconsistency in `architecture.md` (Phase 17, out of scope, left alone); and `observer.add(widget)` is a justified post-construction write documented as the only construction-cycle break (widget needs manager, manager needs observer).
- **Pre-completion reviewer: PASS** — all deterministic checks, code-design, test-artifact, Mermaid (`mmdc` parsed all 6 blocks), dead-code, and cross-step-invariant lenses passed.

[#421]: https://github.com/gotgenes/pi-packages/issues/421
[#422]: https://github.com/gotgenes/pi-packages/issues/422
[#424]: https://github.com/gotgenes/pi-packages/issues/424
[#425]: https://github.com/gotgenes/pi-packages/issues/425
[#427]: https://github.com/gotgenes/pi-packages/issues/427
