---
issue: 442
issue_title: "pi-subagents: dissolve /agents and remove the conversation-viewer subtree"
---

# Retro: #442 — pi-subagents: dissolve /agents and remove the conversation-viewer subtree

## Stage: Planning (2026-06-23T18:06:31Z)

### Session summary

Planned Phase 19 Step 5: dissolve the `/agents` command and delete the conversation-viewer subtree (`agent-menu.ts`, `conversation-viewer.ts`, `message-formatters.ts`, plus their three tests), dewire `index.ts`.
Investigation surfaced a blocker the issue overlooked — a bidirectional type cycle between the hub and its leaves — and the operator chose a tidy-first resolution.
Plan committed at `packages/pi-subagents/docs/plans/0442-dissolve-agents-conversation-viewer.md`; this is a `/build-plan` (no red→green cycles), batched for release with the tail [#441].

### Observations

- Key finding: `agent-creation-wizard.ts` and `agent-config-editor.ts` (which survive until [#441]) both `import type { MenuUI } from "#src/ui/agent-menu"` and use it throughout, while the hub value-imports the wizard/editor classes — a bidirectional cycle.
  Deleting either subtree first breaks `tsc --noEmit` (type-checks `src` + `test`).
  The issue's "pure orphans" premise holds for runtime reachability but not at the type level.
- Flipping the [#442]/[#441] order does **not** fix it (cycle is bidirectional) — surfaced this directly when the operator asked about step ordering.
- Operator decision via `ask_user`: keep two commits, relocate `MenuUI` to a surviving `src/ui/menu-ui.ts` first (tidy-first).
  Rejected alternatives: merge [#441] into [#442] (one deletion commit), or inline a throwaway `MenuUI` into the doomed leaves.
- Operator confirmed release timing: do not release until both [#442] and [#441] land — marker is `mid-batch — defer (batch "dissolve-agents")`, tail is [#441].
- `menu-ui.ts` is intentionally transient (one issue's lifespan); it keeps two live consumers (wizard/editor) immediately, so no fallow dead-code flag; [#441] deletes it with its consumers.
- Verified no collateral: `FsAgentFileOps` stays off the dead-code list because its own test still imports it; `subagents-settings.ts` defines its own `SubagentsSettingsUI` (no `MenuUI` coupling); `ui-stubs.ts`'s `makeMenuUI` is structurally typed; `join`/`buildParentSnapshot` become dead `index.ts` imports and are removed; deleting the consumers orphans no `display.ts` export.
- Change is breaking (the `/agents` command disappears) → deletion commit is `feat(pi-subagents)!:` with a `BREAKING CHANGE:` footer naming `/subagents:settings`, `/subagents:sessions`, and the background widget (verified the real registered command names, not the architecture's proposed `/subagents-settings`).
- Deferred the holistic architecture-doc refresh (Mermaid domain diagram, complexity/health tables, Phase-19-to-history migration) to the batch tail [#441] to avoid double-editing tables that [#441] also touches; [#442] keeps only the current-state file tree, the Step 5 `Outcome:` annotation, and the SKILL.md UI count accurate.

[#441]: https://github.com/gotgenes/pi-packages/issues/441
[#442]: https://github.com/gotgenes/pi-packages/issues/442
