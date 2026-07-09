---
issue: 557
issue_title: "pi-permission-system: serving is resolution — rebuild processInbox on evaluate() + the serving session's Authorizer"
---

# Retro: #557 — serving is resolution — rebuild `processInbox` on `evaluate()` + the serving session's `Authorizer`

## Stage: Planning (2026-07-08T00:00:00Z)

### Session summary

Planned Phase 9 Step 3 across two session branches: an exploration branch mapped the resolution pipeline and uncovered that the issue's literal "escalate to the serving `Authorizer`" would silently re-degrade the forwarded `permissions:ui_prompt` broadcast (the #292 D3/D4 "not degraded" hardening, a documented public contract in `docs/cross-extension-api.md`); this branch stepped back to the phase level, amended the Phase 9 roadmap (commit `21472cf9`: Step 3 fidelity invariant, resolved-direction-1 provenance sentence, Step 4 target reworded to the post-Step-3 topology), and committed the plan (`0557-serving-is-resolution.md`, commit `14cdeea5`).
Filed follow-up #565 for post-ship validation of the recorded decisions.

### Observations

- **Phase-planning gap class**: the roadmap recorded the policy invariant ("parent rules govern children") but not the presentation invariant ("observers see forwarded prompts undegraded") — a step that reroutes an emission path must be checked against `docs/cross-extension-api.md` contracts, not just `src/` behavior.
  The pre-completion reviewer only catches invariants the roadmap documents, so the amendment (not just the plan) was the right fix.
- **Decide-gate outcomes** (operator-confirmed via `ask_user`): (1) fidelity becomes a documented Step 3 invariant with the threaded design — provenance as data on `PromptPermissionDetails`, rendered by `LocalUserAuthorizer`, the single emit site; (2) amendment scope = Step 3 + resolved direction 1 + Step 4 target; (3) serving evaluates the **base** ruleset (`agentName` undefined; requester agent name is display-only).
- **"Threading" smell concern resolved**: operator asked for reassurance that threading isn't a compromise.
  Verified against the taxonomy — not tramp data (every hop reads/relays it), not a control flag (rendered, not branched on), and it echoes the architecture doc's own principal-identity requirement; the rejected alternatives (server-side emission + emit-suppressed authorize; per-request decorator) each re-create a smell Phase 9 kills.
- **Wiring findings**: `ForwardingManager.start` already gates polling on `hasUI && !isSubagent`, so the server's internal `ctx.hasUI` guard is removable dead defense; `index.ts` needs a construction reorder (`prompter` → `authorizerSelection` → `resolver` → `servingPolicy` → `requestServer`), with the `session.getPathNormalizer()` read deferred via the existing logger-`notify`-sink precedent.
- **Accepted behavior shifts** (named for the `feat:` commit body): explicit `deny` now wins under yolo on the serving path; legacy field-less requests prompt instead of yolo-approving; policy-decided requests emit no `permissions:ui_prompt`.
- Deferred: single-surface re-resolution fidelity, base-agent-scope revisit, and notification-consumer verification all live in #565.
