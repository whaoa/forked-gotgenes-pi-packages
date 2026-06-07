---
issue: 339
issue_title: "Extract a context-owning PromptingGateway; collapse the prompt twins"
---

# Retro: #339 — Extract a context-owning PromptingGateway; collapse the prompt twins

## Stage: Planning (2026-06-07T14:21:40Z)

### Session summary

Produced the implementation plan for Phase 4 Step 6: extracting a `PromptingGateway` collaborator out of `PermissionSession` and collapsing the `canPrompt`/`canConfirm` and `prompt`/`promptPermission` twins into a single context-bound pair.
Confirmed the prerequisite Step 1 ([#334]) is closed and the issue only depends on it; Steps 7/8 ([#340]/[#341]) are downstream.
Plan filed at `packages/pi-permission-system/docs/plans/0339-extract-prompting-gateway.md`.

### Observations

- Two design choices surfaced via `ask_user`: (1) rename `GatePrompter.promptPermission` → `prompt` (chosen, matches the issue's literal `prompt(details)`); (2) full clean end state via lift-and-shift for the test fixtures (chosen over a minimal bridge).
- Decided the gateway absorbs the can-prompt policy (`canResolveAskPermissionRequest` + `isSubagentExecutionContext`), not just a relayed closure, so the `index.ts` `canRequestPermissionConfirmation` closure disappears (index closures 11 → 10, matching the roadmap claim at architecture.md line 669).
  Trade-off: gateway deps widen to 4 fields (`config`, `subagentSessionsDir`, `registry`, `prompter`), all used.
- Key constraint identified: the session still needs `this.context` for `getRuntimeContext`/`reload`/`logResolvedConfigPaths`, so this step accepts a transitional dual context store (session copy + gateway copy), synchronized through the single `activate`/`deactivate` path.
  Consolidation deferred to Step 8.
- The session forwards `activate`/`deactivate` to the gateway, mirroring the existing `forwarding.start/stop` pattern — this keeps the production change inside the four target files (`prompting-gateway.ts`, `permission-session.ts`, `runner.ts`, `index.ts`) since every existing `session.activate(ctx)` call site inherits gateway activation.
- Heaviest area is test migration: `MockGateHandlerSession` is the shared pivot; removing its `GatePrompter` fields breaks every constructor at once.
  The `promptPermission` → `prompt` rename also collides with the session's own `prompt(ctx, details)` until the session drops `GatePrompter`, so the rename must land *after* the rewire (cycle 3, not cycle 1).
  `input.test.ts` asserts on `session.promptPermission` directly, and `external-directory-session-dedup.test.ts` has its own local `makeStatefulSession`/`makeHandlerForSession` — both require migration.
- Plan uses a 9-cycle lift-and-shift: add gateway → rewire + bridge → rename → migrate 5 handler suites → drop bridge.
  Small adjacent suites may be grouped.

[#334]: https://github.com/gotgenes/pi-packages/issues/334
[#340]: https://github.com/gotgenes/pi-packages/issues/340
[#341]: https://github.com/gotgenes/pi-packages/issues/341

## Stage: Implementation — TDD (2026-06-07T14:57:32Z)

### Session summary

Completed all 9 TDD cycles: added `PromptingGateway` (cycle 1), wired it into production and shed the session's prompting role with a transitional bridge (cycle 2), renamed `GatePrompter.promptPermission` → `prompt` (cycle 3), migrated 5 handler test suites to steer via the `prompter` mock (cycles 4–8), and removed the bridge and all `undefined as unknown as ExtensionContext` casts (cycle 9).
Test count held at 87 files / 1,823 tests throughout (net zero: the 14 new gateway tests replaced the 4 prompting `describe` blocks removed from `permission-session.test.ts`, plus prior tests migrated rather than added).
Pre-completion reviewer returned WARN with one finding (roadmap Step 6 not marked complete) and one non-blocking lint note (unused `beforeEach` import); both fixed before stage notes.

### Observations

- The cycle 2 → cycle 9 split worked exactly as planned: `MockGateHandlerSession` kept its prompting extras until cycle 9; no handler test case needed touching until its own migration cycle.
- One deviation from the plan: `external-directory-integration.test.ts` had a latent `session.prompt` use in the `"external_directory — allow external reads"` describe block that the plan didn’t list explicitly; it was caught and fixed in cycle 9 when `pnpm run check` rejected the stale session field.
- `GatePrompter` rename sequencing worked cleanly: cycle 3 renamed the interface only after the session dropped it in cycle 2, avoiding the collision with the session’s own `prompt(ctx, details)` method.
- `makeHandlerForSession` in `external-directory-session-dedup.test.ts` was redesigned in cycle 8 to accept an optional `GatePrompter` and return `{ handler, prompter }`, which kept the final cycle 9 cleanup contained to one function.
- Pre-completion reviewer: WARN (resolved before commit — Step 6 marked `✓ complete` in `architecture.md`; unused `beforeEach` import removed from `test/prompting-gateway.test.ts`).
