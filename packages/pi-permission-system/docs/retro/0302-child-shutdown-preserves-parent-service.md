---
issue: 302
issue_title: "Child subagent shutdown unpublishes the parent's global PermissionsService"
---

# Retro: #302 — Child subagent shutdown unpublishes the parent's global PermissionsService

## Stage: Planning (2026-06-01T00:00:00Z)

### Session summary

Investigated the process-global `PermissionsService` slot bug surfaced by the `#297` composition-root suite and produced `docs/plans/0302-child-shutdown-preserves-parent-service.md`.
The fix defers `publishPermissionsService` from factory-init to a child-gated `session_start`, moves `emitReadyEvent` alongside it, and makes `unpublishPermissionsService` identity-scoped (compare-and-delete).
Plan is structured as four TDD steps: extract `isRegisteredSubagentChild`, breaking `unpublishPermissionsService` signature, the `session_start` publish gate, then docs.

### Observations

- Key constraint: the factory has **no `ctx` at init**, so an in-process child cannot be distinguished from a reloaded parent at init (both look like "slot already occupied").
  The registry signal needs a session id, which first appears at `session_start` — this forced the publish to move there, which in turn forced `permissions:ready` to move to preserve the `#297` ordering contract.
- Decided to gate on the **registry-only** `isRegisteredSubagentChild`, not the full `isSubagentExecutionContext`.
  The env/filesystem branches identify process-based subagents (own OS process, own `globalThis`) which *should* publish; only the registry branch marks an in-process child sharing the parent's `globalThis`.
- Rejected a stash/restore alternative (child captures the previous slot at init, restores it at `session_start`) — it is unsound under concurrent sibling children, where one sibling's restore writes back another sibling's service instead of the parent's.
- Chose identity compare-and-delete over a `didPublish` boolean for teardown: the boolean is unsafe if `/reload` re-runs the factory and the old instance's `session_shutdown` fires after the new instance's `session_start` re-publish.
  Identity comparison is order-independent.
- `ask_user` confirmed two decisions: move `permissions:ready` to `session_start` (recommended), and identity compare-and-delete with the maintainer's note "favor the breaking change if it makes a cleaner design" — so `unpublishPermissionsService` takes a **required** param (`feat!:`), not an optional one.
- Package public surface is only `src/service.ts` (the `.` export), which is why the signature change is genuinely public/breaking.
  Sole `src/` caller is the `index.ts` cleanup closure; consumers use only `getPermissionsService()`.
- Doc updates identified: `service.ts`, `permission-events.ts`, `docs/cross-extension-api.md` (events table + Ready Event section + reload notes), `docs/architecture/architecture.md`.
  Re-grep the package skill before the docs commit.
