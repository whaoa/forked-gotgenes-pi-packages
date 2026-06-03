---
issue: 327
issue_title: "Extract a ToolCallGatePipeline collaborator that owns tool-call gate construction"
---

# Retro: #327 — Extract a ToolCallGatePipeline collaborator that owns tool-call gate construction

## Stage: Planning (2026-06-03T03:45:47Z)

### Session summary

Produced the implementation plan for extracting a `ToolCallGatePipeline` collaborator that owns tool-call gate construction, narrowing `PermissionSession` with `getToolPreviewLimits()` / `getInfrastructureReadDirs()`, and removing the anemic `getInfrastructureDirs` / `getInfrastructureReadPaths` getters.
The plan is a five-step lift-and-shift (add session methods → introduce pipeline + tests → inject and delegate → remove dead getters → docs), all behavior-preserving.
Confirmed #326 (handleInput unification) is already landed, so the handler's `handleInput` is unchanged here.

### Observations

- Settled the `evaluate(...)` seam the issue left open: chose `evaluate(tcc, runner)` with the pipeline owning the bash-command extraction and the single `BashProgram.parse`, since those are purely tool-call gate-construction inputs that `handleInput` never needs (decided via `ask_user`).
- The user corrected an initial draft that constructed the pipeline inside the `PermissionGateHandler` constructor — that violated dependency injection.
  Revised so `index.ts` constructs the pipeline and injects it; the handler also drops its now-unneeded `customFormatters` constructor parameter.
  Deliberately left the pre-existing `new GateRunner(...)` / `new GateDecisionReporter(...)` construction in the handler constructor alone — relocating those is the explicit scope of #320 and #325, and folding them in would balloon the issue.
- Chose a narrow pipeline-owned interface `ToolCallGateInputs` (extends `PermissionResolver`) over depending on the concrete `PermissionSession`, so the new pipeline unit tests stay cast-free.
  Avoided a layer inversion by **not** declaring `PermissionSession implements ToolCallGateInputs` — the structural check lives at the `new ToolCallGatePipeline(session, ...)` call site, keeping the domain module free of an upward import from the handler layer.
- The runner is passed per-call to `evaluate` rather than injected into the pipeline, because the same `GateRunner` instance is shared with `handleInput`.
- Key follow-on risk for `/tdd-plan`: the session mocks are cast via `as unknown as PermissionSession`, so renamed/added methods (`getInfrastructureReadDirs`, `getToolPreviewLimits`) fail at runtime, not at typecheck — step 3 must update every session mock on the handler/pipeline path and run the full suite.
