---
issue: 531
issue_title: "pi-permission-system: remove the deprecated permissions:rpc:check / permissions:rpc:prompt event-bus channel"
---

# Retro: #531 — Remove the deprecated `permissions:rpc:check` / `permissions:rpc:prompt` event-bus channel

## Stage: Planning (2026-07-07T16:00:48Z)

### Session summary

Planned Phase 8 Step 7: the subtractive removal of the event-bus RPC subsystem (`permissions:rpc:check` + `permissions:rpc:prompt`) in favor of the surviving `Symbol.for()` `PermissionsService` accessor.
Wrote `docs/plans/0531-remove-deprecated-event-bus-rpc.md` with an atomic code+test removal step, a docs-repoint step (including marking the roadmap step ✅), and a `#309` scope-narrowing comment.
Release recommendation: ship independently as its own `feat(pi-permission-system)!:` major bump.

### Observations

- The issue and roadmap both say "remove `permissions:rpc:check` / `permissions:rpc:prompt`", but only the **check** channel/types carry `@deprecated` JSDoc in code — the **prompt** channel is not marked deprecated and its types (`PermissionsPromptRequest`, `PermissionsPromptReplyData`, `PermissionsRpcReply`, `PERMISSIONS_RPC_PROMPT_CHANNEL`) are publicly re-exported from `service.ts`.
  The roadmap's Findings section treats the prompt handler as a deprecated third elicitation path, so removal is intended; the plan removes both and notes the larger-than-labeled public-API break, subsumed by the major bump.
- Resolved two dead-code cascade calls per code-design's remove-dead-code rule: (1) `PERMISSIONS_PROTOCOL_VERSION` and `PermissionsRpcReply` are RPC-only (surviving broadcasts explicitly carry no `protocolVersion`), so both are removed; (2) `buildRpcUiPrompt` / `RpcPromptInput` and the `"rpc_prompt"` member of `PermissionUiPromptSource` (plus the `UI_PROMPT_SOURCES` whitelist entry in `authority/forwarding-io.ts`) are dead once the prompt handler is gone.
  Verified the file-based forwarded inbox never persisted `"rpc_prompt"`, so narrowing the union cannot orphan a stored request.
- "Unwire from `PermissionServiceLifecycle`" is a slight misnomer: `service-lifecycle.ts` takes the subscription list as an opaque `readonly (() => void)[]` and has no RPC reference — the actual edit is dropping the two `rpcHandles.unsub*` handles at the `index.ts` construction site.
- Removal is atomic by necessity: dropping the public exports from `permission-events.ts` breaks `service.ts`, the deleted handler, and all consumer tests at the type level in one commit — folded into a single `feat!` step per AGENTS.md guidance.
- Grep confirmed zero cross-package RPC consumers and no RPC references in `README.md` / `configuration.md` / schema / example config.
  The only remaining references after the change live in the frozen `docs/architecture/history/*.md` files, intentionally left unchanged.
- This is a pure narrowing change, so the `design-review` checklist (aimed at added/widened interfaces) finds nothing to fix — noted rather than run field-by-field.
- No follow-up issues filed; Open Questions is empty.
  The `#309` comment is an implementation action, not a new issue.
