---
issue: 385
issue_title: "pkg:pi-permission-system — Respect pi default active tool set instead of activating all non-denied tools"
---

# Retro: #385 — Respect pi default active tool set instead of activating all non-denied tools

## Stage: Planning (2026-06-11T21:43:29Z)

### Session summary

Planned the fix for `AgentPrepHandler.handle()` activating pi's off-by-default tools (`find`/`grep`/`ls`) in every session.
The fix switches the base set from `pi.getAllTools()` to `pi.getActiveTools()`, making the permission system purely restrict-only.
Evaluated the issue author's reference PR [#386] and adopted its approach with two improvements: typing `getActive(): string[]` to match the real SDK contract (PR used `unknown[]`) and adding an explicit regression test.

### Observations

- Confirmed via the SDK `.d.ts` that `getActiveTools()` returns `string[]` while `getAllTools()` returns `ToolInfo[]`.
  PR #386's test mocks return objects for `getActive`, which pass only because `getToolNameFromValue` tolerates both shapes — a fidelity gap the plan fixes by returning bare strings everywhere.
- `PermissionGateHandler` keeps `getAll()` for `validateRequestedTool` (registration checks must see the full registry); only `AgentPrepHandler` switches to `getActive()`.
  This leaves a latent ISP seam (disjoint consumer slices of `ToolRegistry`) — recorded as track-and-watch, not split now.
- Classified as **breaking** (confirmed with the user via `ask_user`): the main session's effective tool set changes on upgrade without a user edit, so `fix!:` + `BREAKING CHANGE:` footer.
  The restrict-only contract means users wanting `find`/`grep`/`ls` active must enable them via pi's own `activeTools` config.
- Verified idempotence: starting from the active set makes the operation purely subtractive toward a fixed point, so no oscillation across repeated `before_agent_start` fires.
- Key risk flagged for TDD: confirm `getActiveTools()` is already populated with pi's defaults when `before_agent_start` fires (lifecycle timing).
  PR #386's existence suggests the reporter validated this empirically.
- Credit: Ben Tang (@0xbentang) reported #385 and authored reference PR [#386].
  The plan records a `Co-authored-by: Ben Tang <bentang@fastmail.com>` trailer for the implementation commits so the credit lands in git history.

[#386]: https://github.com/gotgenes/pi-packages/pull/386
