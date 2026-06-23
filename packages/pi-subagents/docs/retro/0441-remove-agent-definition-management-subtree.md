---
issue: 441
issue_title: "pi-subagents: remove the orphaned agent-definition management subtree"
---

# Retro: #441 — pi-subagents: remove the orphaned agent-definition management subtree

## Stage: Planning (2026-06-23T00:00:00Z)

### Session summary

Produced a deletion-only plan for Phase 19 Step 6: `git rm` the orphaned creation wizard, config editor, and their two file-ops helpers (plus tests), prune `test/helpers/ui-stubs.ts` to just `makeMenuUI`, and update the two current-state docs.
Verified against `main` that the five modules are pure orphans (no `src/` importer, `index.ts` clean) and that this is the unreleased tail of release batch "dissolve-agents".
The plan routes to `/build-plan` (no test cycles) with two commits.

### Observations

- Two deviations from the issue body, both forced by the codebase + the authoritative architecture doc rather than by preference, so no `ask_user` gate was used:
  1. `menu-ui.ts` (the `MenuUI` interface) must also be deleted — it is orphaned by the same cut, and `architecture.md` lines 346/1076 explicitly schedule its removal under #441.
     The issue body omits it.
  2. `makeMenuManager` is removed whole, not just its `spawnAndWait` field — after the four test files go, its only consumer is its own self-test, so it is residual clutter.
     The architecture doc's "if no surviving consumer remains" phrasing licenses this.
- `ui-stubs.ts` survives because `makeMenuUI` still has a real consumer (`subagents-settings.test.ts`); only the three other helpers (and the private `DEFAULT_TEST_AGENT_CONFIG` + the `AgentConfig` import) are pruned.
- Commit type is `refactor(pi-subagents):`, not `feat!:` — deleting already-unreachable code changes no observable behavior at this step.
  The release is driven by Step 5's unreleased breaking `feat!:` (`cb813f2c`, after tag `pi-subagents-v17.5.0`); landing this tail lets release-please cut the major bump.
- Production duplication goes to zero when `agent-config-editor.ts` is deleted (the 11-line `disableAgent`/`ejectAgent` clone); pin with `pnpm fallow dupes`.
- Historical docs under `docs/plans/`, `docs/retro/`, and `docs/architecture/history/` mention the deleted modules only as records of completed phases — left untouched per convention; only `architecture.md` current-state and `SKILL.md` are updated.
