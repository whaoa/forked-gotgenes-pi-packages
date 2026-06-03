---
issue: 325
issue_title: "Depend on session role interfaces in PermissionGateHandler, not the concrete PermissionSession class"
---

# Retro: #325 — Depend on session role interfaces in PermissionGateHandler

## Stage: Planning (2026-06-03T04:47:43Z)

### Session summary

Produced the implementation plan for retyping `PermissionGateHandler` against a narrow `GateHandlerSession` role and dropping the `as unknown as PermissionSession` casts.
The issue body (written before [#326]/[#327] landed) lists 12 session members and an open "residual cluster" question; the current code already shrank that residual to four methods (`activate`, `resolveAgentName`, `checkPermission`, `createPermissionRequestId`), so the plan is a small finishing move.
Stepping back per the maintainer's prompt, I expanded the design to inject the pre-built `GateRunner` (not just the `DecisionReporter`), filed three follow-up issues, and updated the Phase 3 roadmap.

### Observations

- The referenced dependencies [#319]/[#322]/[#323] are still **open** in the tracker but their code (`permission-resolver.ts`, `decision-reporter.ts`, `gate-prompter.ts`, `session-approval-recorder.ts`) is merged, and later phases [#326]/[#327] are done — so [#325] is unblocked despite the open labels.
- Decision (confirmed via `ask_user`): inject the whole `GateRunner` rather than only the `DecisionReporter` the roadmap originally named.
  This narrows the handler's `session` role to exactly four methods (the three runner roles move to the `index.ts` wiring) and removes the `session.logger` reach-through — the same LoD smell [#322] removed from the runner.
  Also drops the `events` constructor param.
- Decision: define a flat four-method `GateHandlerSession` rather than pre-splitting a two-method `SessionContext` base.
  A `SessionContext` abstraction gets a second consumer only with [#329]/[#331], so introducing it now would be a speculative export `fallow` could flag.
- The shared `makeSession` in `handler-fixtures.ts` is used **only** by `PermissionGateHandler` tests; `before-agent-start.test.ts` and `lifecycle.test.ts` have their own local `makeSession` and import only `makeCtx`.
  So narrowing the shared fixture is safe and does not touch the other handlers.
- Cast-removal wrinkle to watch in implementation: the mocks' `resolve`/`canConfirm`/`promptPermission` delegate to `checkPermission`/`canPrompt`/`prompt` and are currently assigned **after** the `as unknown as` cast.
  Without the cast the object literal must satisfy the type at creation; the plan resolves this by defining the delegations inline as closures that read the final `session` object at call time, then spreading `...overrides` last (replacing the `Object.hasOwn` guards).
  `external-directory-session-dedup.test.ts` is the canary because it drives stateful session-approval through these delegations.
- Two vestigial mock members (`getToolPermission`, `config`) exist only to satisfy the concrete class and can be dropped once the type is narrowed.
- Broader findings filed as issues (maintainer approved stepping back): [#329] extract a `SkillInputGatePipeline` (the `handleInput` skill-input assembly is still inline, asymmetric with `ToolCallGatePipeline`); [#330] relocate `createPermissionRequestId` off `PermissionSession` (it touches zero session state — maintainer noted it should land on the request-creation collaborator, not a free function); [#331] narrow `AgentPrepHandler` + `SessionLifecycleHandler` the same way.
- Behavior-preserving constraint kept: the skill-input pre-check stays on raw `checkPermission` (no session rules); switching it to `resolve` is a behavior change deferred to [#329].
- Roadmap integration (second pass, on review feedback): the three follow-ups were first parked in an ad-hoc "Phase 3 follow-ups" table, which deviated from the roadmap convention (one issue per numbered step + a node in the Mermaid graph).
  Reworked them into proper Steps and graph nodes.
- Resequencing (third pass, on review feedback): [#329] (`SkillInputGatePipeline`) introduces a new collaborator that `index.ts` must construct, so it must land **before** [#320] (the composition-root reframe) — otherwise [#320] cools the `index.ts` hotspot only for [#329] to re-touch it.
  Renumbered the Phase 3 tail so reading order matches execution order: Step 12 [#329], Step 13 [#330], Step 14 [#331], Step 15 [#320], Step 16 [#321]; updated the dependency diagram (`S12 --> S15`), the prose, the Tracks table, and the plan's Non-Goals cross-reference.
- Tooling friction: `pi-autoformat` re-pads Mermaid blocks and tables after every `Write`/`Edit`, so batched multi-edit calls against those regions went stale mid-call and failed atomically.
  Splitting into smaller targeted edits (and using length-preserving replacements for padded table cells) landed them cleanly.
  Worth remembering for any future edit touching the architecture doc's diagrams or tables.

[#319]: https://github.com/gotgenes/pi-packages/issues/319
[#322]: https://github.com/gotgenes/pi-packages/issues/322
[#323]: https://github.com/gotgenes/pi-packages/issues/323
[#326]: https://github.com/gotgenes/pi-packages/issues/326
[#327]: https://github.com/gotgenes/pi-packages/issues/327
[#329]: https://github.com/gotgenes/pi-packages/issues/329
[#330]: https://github.com/gotgenes/pi-packages/issues/330
[#331]: https://github.com/gotgenes/pi-packages/issues/331
