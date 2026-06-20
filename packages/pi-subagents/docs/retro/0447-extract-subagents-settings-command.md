---
issue: 447
issue_title: "pi-subagents: extract subagent settings to a focused /subagents-settings command"
---

# Retro: #447 — pi-subagents: extract subagent settings to a focused /subagents-settings command

## Stage: Planning (2026-06-20T00:00:00Z)

### Session summary

Produced a numbered TDD plan for Phase 19 Step 2: a purely additive extraction of `AgentsMenuHandler.showSettings` into a standalone `SubagentsSettingsHandler` registered as the `/subagents-settings` command.
Confirmed the command name against the closed spike (#446) and its ADR-0004 addendum (Criterion 4), and verified `SettingsManager` already structurally satisfies the new narrow manager interface so it can be passed directly.
The plan ships independently (roadmap `Release: independent`).

### Observations

- The extraction is a faithful verbatim lift — `showSettings` already had zero coupling beyond `this.settings` and `ui`, so the design-review checklist came back clean (100% field usage on both new narrow interfaces, no LoD/output-arg smells).
  Classified as a genuine collaborator extraction, not procedure-splitting.
- Declared two narrow interfaces owned by the new module: `SubagentsSettingsManager` (shape-identical to the doomed `AgentMenuSettings` but with no import from `agent-menu.ts`) and `SubagentsSettingsUI` (drops `confirm`/`editor`/`custom` from `MenuUI` — ISP).
- Strictly additive: `agent-menu.ts` is untouched, and its settings tests stay as-is because the in-menu path keeps shipping until Step 5 (#442) deletes the file.
  Removing them now would drop coverage of a live surface.
- Preserved the single-selection-then-return semantics of `showSettings` verbatim (no re-show loop) — flagged a settings re-show loop as a deferred UX open question.
- Two small TDD steps (handler+tests, then `index.ts` registration); noted they may fold into one commit since the export and its sole call site are tiny, with `pnpm run check` required right after the wiring step.
- No third-party `ask_user` gate needed — issue filed by the operator (`gotgenes`), direction fixed by ADR-0004, design unambiguous.
