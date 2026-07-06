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
