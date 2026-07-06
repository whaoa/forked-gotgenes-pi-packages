---
issue: 527
issue_title: "pi-permission-system: delete dead yolo arms from the prompt path; dissolve yolo-mode.ts"
---

# Retro: #527 — delete dead yolo arms from the prompt path; dissolve `yolo-mode.ts`

## Stage: Planning (2026-07-05T00:00:00Z)

### Session summary

Planned Phase 8 Step 3: a pure narrowing that deletes the two unreachable yolo branches Step 2 ([#526]) left behind (the `PermissionPrompter` auto-approve arm and `PromptingGateway.canConfirm()`'s yolo arm), dissolves `src/yolo-mode.ts` by moving `isYoloModeEnabled` into `extension-config.ts`, and drops the now-dead `config` dependency from `PermissionPrompterDeps` and `PromptingGatewayDeps`.
The plan is four commits (three `refactor:` cycles plus a `docs:` completion commit) and is the tail of the "yolo-recorded-authority" release batch, so it ships now.

### Observations

- The issue text says only "move `isYoloModeEnabled`"; tracing the two `shouldAutoApprovePermissionState` call sites showed the prompter arm is the only caller passing a variable `state` — once it is removed, the serve arm always passes `"ask"`, so `shouldAutoApprovePermissionState` collapses to `isYoloModeEnabled` and is deleted rather than moved.
  The serve arm re-points at `isYoloModeEnabled` (behavior-identical), keeping `test/permission-forwarder.test.ts` green as the invariant pin.
- Removing the `config` field from both dependency bags is a dependency-width *narrowing*, so the design-review checklist confirmed no new structural smell — the fixes are inline, not a follow-up.
- The safety of deleting the prompter arm rests on the exhaustive reachability trace recorded in the [#526] retro (no `ask` reaches the prompter under yolo); cited it in "Invariants at risk" rather than re-deriving it.
- `test/yolo-mode.test.ts` is deleted outright: its two subjects are removed, and its lone `resolvePermissionForwardingTargetSessionId` assertion duplicates an existing case in `test/permission-forwarding.test.ts` ("isSubagent=true, no candidates set returns null"), so no relocation is needed.
- Doc sweep targets: `docs/architecture/architecture.md` (module tree line, `prompting-gateway.ts` description, two metric rows, Step 3 `✅` marker + Mermaid node) and `docs/architecture/permission-prompter.md` (the [#526] retro flagged this one rides with #527).
  No `README.md` command-surface change.

[#526]: https://github.com/gotgenes/pi-packages/issues/526

## Stage: Implementation — TDD (2026-07-05T00:00:00Z)

### Session summary

Executed all four planned commits: removed `PermissionPrompter`'s dead auto-approve arm, reduced `PromptingGateway.canConfirm()` to `hasUI ∨ isSubagent` and deleted `canResolveAskPermissionRequest`/`AskPermissionResolutionOptions`, dissolved `src/yolo-mode.ts` (moved `isYoloModeEnabled` into `extension-config.ts`, deleted `shouldAutoApprovePermissionState`, re-pointed the forwarded-inbox serve arm), then updated `architecture.md` (Step 3 ✅ marker, Mermaid node, module tree, two metric rows) and `permission-prompter.md`.
Test count moved 2299 → 2283 (removed 4 prompter yolo tests, 1 gateway yolo test, 8 `yolo-mode.test.ts` tests; added 3 `isYoloModeEnabled` tests in `extension-config.test.ts`).
The `pre-completion-reviewer` returned PASS on the first dispatch.

### Observations

- No deviations from the plan — all four TDD steps landed exactly as designed, including the dependency-bag narrowing (`config` dropped from both `PermissionPrompterDeps` and `PromptingGatewayDeps`) and the serve-arm re-point to `isYoloModeEnabled` with the Phase 9 retention comment.
- Followed the plan's metrics-table guidance by prefixing `✅` on the Target-column values for "yolo checks on the ask path" and "canConfirm() predicates" (matching the precedent in `docs/architecture/history/phase-7-accesspath-universal-representation.md`) rather than mutating the frozen "Phase 7 close" baseline column.
- The `test/permission-forwarder.test.ts` serve-arm test needed no edit — confirmed the plan's claim that `isYoloModeEnabled` is behavior-identical to the old `shouldAutoApprovePermissionState("ask", …)` call it replaced.
- Pre-completion reviewer: PASS.
  Reviewer warnings: one non-blocking note — `architecture.md`'s "Target: the authority model" section (~line 500) still names `yolo-mode.ts` in a "today these concerns are spread across…" sentence; this was outside the plan's declared doc-sweep scope (module tree, Step 3 marker, two metric rows, `permission-prompter.md`) and is left for a future spine-related doc pass.
- Batch status: this is the tail of "yolo-recorded-authority" (Steps 2, 3) — `/ship-issue` should now merge the release-please PR left open by [#526]'s `mid-batch — defer` marker.
