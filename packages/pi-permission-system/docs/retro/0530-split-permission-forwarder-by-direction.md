---
issue: 530
issue_title: "pi-permission-system: split PermissionForwarder by direction of authority flow"
---

# Retro: #530 — pi-permission-system: split PermissionForwarder by direction of authority flow

## Stage: Planning (2026-07-07T00:00:00Z)

### Session summary

Planned Phase 8 Step 6: splitting the 578-line dual-role `PermissionForwarder` into `ApprovalEscalator` (escalation-up, `ApprovalRequester`) and `ForwardedRequestServer` (serving-down, `InboxProcessor`), relocating the forwarding subsystem into `src/authority/` and dissolving `src/forwarded-permissions/`.
The plan is a non-breaking `refactor:` sequenced as three tidy-first extraction commits plus a doc-update commit, filed at `packages/pi-permission-system/docs/plans/0530-split-permission-forwarder-by-direction.md`.

### Observations

- The 7-field `PermissionForwarderDeps` bag partitions cleanly by role: `detection`/`registry` are escalation-only, `config`/`events` are serving-only, and `forwardingDir`/`logger`/`requestPermissionDecisionFromUi` are shared — so each new deps interface is a strict 5-field narrowing.
  Confirmed the escalation UI fast path does **not** emit a UI event (the prompter does), which is why the escalator drops `events`.
- The issue's proposed change lists 3 target files but omits where the shared `ForwarderContext` type + `getSessionId` helper live (both classes and both seams need them).
  Asked the operator; confirmed a dedicated `src/authority/forwarder-context.ts` over folding into `forwarding-io.ts` or duplicating across the sibling classes.
- Consumers are well-contained: only `permission-prompter.ts` (`ApprovalRequester`), `forwarding-manager.ts` (`InboxProcessor`), and `index.ts` import the split symbols; `composition-root.test.ts` reaches forwarding via the real factory, not direct imports.
- Doc-staleness sweep found `docs/architecture/architecture.md` (module tree, Step 6 marker, metrics row), `docs/architecture/permission-prompter.md`, and `.pi/skills/package-pi-permission-system/SKILL.md` naming the old symbols; the frozen `docs/architecture/history/` phase docs are intentionally left as-is.
- Roadmap tags Steps 4–6 `Release: independent` with no batch; as a hidden `refactor:` type this lands and auto-batches into the next release rather than cutting one — Release Recommendation worded accordingly.
- Next step is `/tdd-plan` (pure-refactor cycles: relocate code + tests, keep the suite green).

## Stage: Implementation — TDD (2026-07-07T10:50:00Z)

### Session summary

Executed all 4 planned steps as 4 commits: (1) renamed `io.ts` → `forwarding-io.ts` and extracted the shared `ForwarderContext` + `getSessionId` into a new `forwarder-context.ts`; (2) extracted `ForwardedRequestServer` (serving-down role) into `src/authority/`, narrowing `PermissionForwarderDeps` to escalation-only fields; (3) renamed the remaining `PermissionForwarder` → `ApprovalEscalator` and dissolved both `src/forwarded-permissions/` and `test/forwarded-permissions/`; (4) updated `architecture.md`, `permission-prompter.md`, the package `SKILL.md`, and two doc comments (`session-logger.ts`, `subagent-detection.ts`).
Test count: 112 → 113 test files (one new file, `forwarded-request-server.test.ts`), 2300 → 2300 tests (no net change — pure relocation/split, no new or removed test cases).
All deterministic checks (`pnpm run check`, `pnpm run lint`, `pnpm run test`, `pnpm fallow dead-code`) passed clean at the end.

### Observations

- No deviations from the plan.
  The dependency partition predicted in planning (5-field `ApprovalEscalatorDeps` / 5-field `ForwardedRequestServerDeps`) held exactly as designed; no unplanned coupling surfaced.
- One planning gap surfaced during Step 2: the two `requestApproval` tests in the escalator's test file passed an `events` mock into deps purely to assert `events.emit` was never called — but `ApprovalEscalatorDeps` no longer has an `events` field.
  Fixed by keeping the `events` mock as a standalone assertion target (not injected into deps), preserving the "escalator never emits UI events" documentation value of the test without a type error.
- The empty `test/forwarded-permissions/` directory (left over from Step 1's file move) had to be `rmdir`'d explicitly in Step 3 — git does not track empty directories, so the Step 1 commit left a stray empty dir on disk that only became visible once Step 3 tried to remove the sibling `src/forwarded-permissions/`.
- Updated the "What it consolidates" bullet in the Target authority-model section (not explicitly named in the plan's Module-Level Changes) to stop describing the split as future Phase 9 work, since Phase 8 Step 6 already completed it — judged this was within the plan's "verify no current-state prose still claims the class is unsplit" instruction rather than scope creep.
- Pre-completion reviewer: **PASS**.
  No findings; verified the dependency partition, doc updates, cross-step invariants (Step 4 `#528` harness, Step 5 `#529` `SubagentDetector` seam), Mermaid diagrams, and planned follow-up issues (`#531`, `#532`) all check out.
