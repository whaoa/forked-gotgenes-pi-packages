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
