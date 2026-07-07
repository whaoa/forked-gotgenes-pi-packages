---
issue: 529
issue_title: "pi-permission-system: extract a SubagentDetection collaborator; seed src/authority/"
---

# Retro: #529 — pi-permission-system: extract a SubagentDetection collaborator; seed src/authority/

## Stage: Planning (2026-07-06T00:00:00Z)

### Session summary

Produced `docs/plans/0529-extract-subagent-detection.md`: a 7-step TDD plan that moves `subagent-context.ts` into `src/authority/`, adds a `SubagentDetection` class (constructed once in `index.ts`), and rewires four consumers onto two ISP seams (`SubagentDetector`, `RegisteredChildDetector`).
Release recommendation: ship independently (roadmap `Release: independent`; all-`refactor:` commits auto-batch into the next release).

### Observations

- Two design forks were surfaced via `ask_user` and resolved by the operator: **(1) Complete scope** — `SubagentDetection` also owns `isRegisteredChild(ctx)` and `service-lifecycle.ts` is rewired onto it (a fourth consumer beyond the issue's three), so all subagent-detection predicates get one owner; **(2) Delegate** — the pure functions `isSubagentExecutionContext` / `isRegisteredSubagentChild` stay exported and the class delegates, preserving the 372-LOC `subagent-context.test.ts` intact (it moves to `test/authority/` with only an import-path change).
- `PermissionForwarder` keeps its `registry` dep — it uses the registry directly for `resolvePermissionForwardingTargetSessionId` (registry-as-data), separate from detection.
  Only `subagentSessionsDir` and `platform` drop from `PermissionForwarderDeps`.
- The rewire obsoletes the last `vi.mock` module mock in `test/forwarding-manager.test.ts` (the reason that file was left off the #528 forwarding harness); it gets a one-field fake detector instead but stays off the harness per that plan's Non-Goals.
- Per-ask re-evaluation inside `PermissionForwarder` (two `isSubagent` calls per forwarded ask) is deliberately **not** collapsed — the once-per-session selection is Phase 9's Authorizer job.
- Docs inventory: `architecture.md` needs the Step 5 ✅ (heading + Mermaid `S5` + metrics row), a `Landed:` bullet documenting the scope widening, the line-424 path fix, and an `authority/` subtree in the module-layout tree; SKILL.md, README, and `docs/subagent-integration.md` were checked and need no changes (they reference the still-exported function / module leaf name only).
- No follow-up issues filed — Step 6 (#530) already exists and consumes this step's output.

## Stage: Implementation — TDD (2026-07-06T21:54:00Z)

### Session summary

Executed all 7 TDD steps as planned: mechanical `git mv` of `subagent-context` into `src/authority/`, added the `SubagentDetection` class (two ISP seams), rewired the four consumers (`PromptingGateway`, `ForwardingManager`, `PermissionForwarder`, `PermissionServiceLifecycle`) onto the collaborator, and marked Phase 8 Step 5 complete in `architecture.md`.
Test count went from 2293 → 2300 (+7 from the new `subagent-detection.test.ts`); `check`, root `lint`, and `fallow dead-code` all green.
Pre-completion reviewer returned PASS.

### Observations

- One deviation from the plan's Module-Level Changes: `test/permission-forwarder.test.ts` needed **no** edits — its only non-UI case is the deny path (`isSubagent` must be `false`), which the default `isSubagent → false` fixture in `makeForwarderDeps` satisfies; no test exercised the forwarded (`isSubagent` true) path directly (that round-trip lives in `composition-root.test.ts`).
  Only `test/helpers/forwarding-fixtures.ts` changed for the forwarder rewire.
- `pi-autoformat` reordered imports on several `src/` files after the step-1 move, so a few `Edit` `oldText` blocks had to be re-anchored against the reflowed import order (re-read before editing).
- The per-consumer rewires (steps 3–6) were cleanly independent thanks to the delegate approach: the pure functions stayed live, so each consumer flipped to the seam one commit at a time with `index.ts` coexisting old + new wiring.
- `subagentRegistry` remains in `index.ts` for `subscribeSubagentLifecycle` and `PermissionForwarderDeps.registry` (target resolution) — confirmed still used, not dead after the service-lifecycle rewire.
- Reviewer noted the unrelated in-range commit `72c15808` (pluggable escalation seam note) from a prior branch also touches `architecture.md`; it is valid and separate, not part of #529's TDD order.
- Pre-completion reviewer: PASS — ready for `/ship-issue`.
