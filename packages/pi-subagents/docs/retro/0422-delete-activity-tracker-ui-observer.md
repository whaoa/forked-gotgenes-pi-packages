---
issue: 422
issue_title: "pi-subagents: delete AgentActivityTracker and ui-observer, drop the activity map from the core"
---

# Retro: #422 — Delete AgentActivityTracker and ui-observer, drop the activity map from the core

## Stage: Planning (2026-06-17T00:00:00Z)

### Session summary

Planned Phase 18 Step 3 of the activity-tier disentanglement spine: deleting `AgentActivityTracker` and `ui-observer`, and removing `SubagentRuntime.agentActivity` plus the tracker wiring in the two spawn tools.
Verified the prerequisites (#420, #421) are both closed and that the trackers/map are now write-only dead state after the reader migration.
Wrote a four-step plan (two `refactor:` deletion commits, a module-delete commit, a `docs:` sweep) at `packages/pi-subagents/docs/plans/0422-delete-activity-tracker-ui-observer.md`.

### Observations

- The change is **non-breaking** and internal-only: `AgentActivityTracker`, `ui-observer`, and `agentActivity` are absent from the public service surface (`service.ts`) and settings entry, so no `BREAKING CHANGE` footer.
  Issue author is the operator (`gotgenes`) and the proposed change is unambiguous and roadmap-driven, so the `ask-user` gate was skipped.
- The foreground `observer.onSessionCreated` callback **stays** — it is still the only place `recordRef`/`fgId` bind mid-flight and where `widget.ensureTimer()` fires; only the tracker lines are stripped.
  The background `observer` block, by contrast, did only tracker work and is removed entirely.
- Commit ordering matters: Step 1 (spawners stop passing `agentActivity`) must precede Step 2 (remove the runtime field), or the build breaks.
  Both the param removal and the field/`AgentActivityAccess` removal cascade to call sites and tests at the type level, so each is folded into a single commit.
- Re-render cadence: dropping `subscribeUIObserver` removes event-driven foreground re-renders, leaving the existing 80 ms spinner poll.
  Content is identical within ≤80 ms (the poll reads the same record the core observer populates) — pinned by the streaming-`onUpdate` test, noted as a risk not a regression.
- Found a **pre-existing stale doc** from #421: `architecture.md` still says "the widget reads agent state by polling a shared `Map<string, AgentActivityTracker>`", though #421 already moved the widget onto records.
  Folded that correction into this plan's Step 4 doc sweep alongside the file tree, two Mermaid diagrams, and the SKILL.md domain counts (UI `12 → 10`, header `59 → 57` files).
- Confirmed no orphaned sibling exports: `SessionLike` (used by `subagent-session.ts`) and `SubscribableSession` (used by `record-observer.ts`, `subagent-session.ts`, `types.ts`) both survive the module deletion; `pnpm fallow dead-code` is the Step 3 backstop.

## Stage: Implementation — TDD (2026-06-17T20:40:00Z)

### Session summary

Executed all four planned steps as a deletion refactor: stripped tracker wiring + the `agentActivity` parameter from the spawners, removed the activity map from `SubagentRuntime`/`AgentToolRuntime`, deleted `agent-activity-tracker.ts` and `ui-observer.ts` (−145 LOC) plus their suites, and swept the architecture doc + SKILL.md.
Landed in six commits (four planned + one folded test removal + one `style:` lint fixup).
Test count dropped −34 (1066 → 1032) across 63 files (was 65); `check`, root `lint`, full `test`, and `fallow dead-code` all green.

### Observations

- **Deviation (test removal moved earlier):** the agent-tool "registers activity in agentActivity map" test was planned for Step 2 but had to be removed in Step 1 — once the spawner stops populating the map, the test fails at runtime in that commit.
  Folded into Step 1 per the testing skill's "account for tests that break" rule.
- **Deviation (atomic-batch trap):** the Step 2 multi-edit `Edit` on `runtime.ts` was rejected because edit[1] miscounted a decorative `─` rule, which silently dropped edit[0] (the `AgentActivityTracker` import removal).
  `tsc` passed at Step 2 because the leftover was an elided `import type`; it only surfaced as a tsc/fallow error once Step 3 deleted the module.
  Removed it in Step 3 and re-read the region after editing.
  This is exactly the AGENTS.md warning about anchoring on decorative rules.
- **Lint fixup:** an unused `runtime` destructure remained in one `background-spawner.test.ts` case.
  It belongs to Step 1's file but HEAD was the `docs:` commit (a fixup must not land in a `docs:` commit, and amending a non-HEAD `refactor:` commit needs a rebase), so it landed as a standalone `style:` commit.
- **No behavior regression:** foreground re-renders now rely solely on the 80 ms spinner poll (the second `subscribeUIObserver` subscription is gone); pinned by the surviving "calls onUpdate with streaming details while running" test.
- **Doc correction:** fixed the pre-existing stale `architecture.md` prose that still claimed the widget polls a `Map<string, AgentActivityTracker>` (the widget moved onto records in #421); now reads "polls the records exposed via `SubagentManager.listAgents()`".
- **Pre-completion reviewer: PASS** — all deterministic checks, code-design, test-artifact, Mermaid (`mmdc` parsed all 6 blocks), dead-code, and cross-step-invariant lenses passed; no warnings.
