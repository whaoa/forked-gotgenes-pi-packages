---
issue: 427
issue_title: "pi-subagents: reconsider the UI direction from first principles (ADR)"
---

# Retro: #427 — pi-subagents: reconsider the UI direction from first principles (ADR)

## Stage: Planning (2026-06-18T00:00:00Z)

### Session summary

Planned the Phase 18 Step 8 decision-only ADR for the pi-subagents UI direction.
Two `ask_user` rounds with the operator (their own issue) settled a per-component decision and surfaced a key SDK finding — Pi's `switchSession(sessionPath)` — that reshapes the conversation-viewer direction.
The plan writes `docs/decisions/0004-reconsider-ui-direction.md` plus an architecture-doc update; no `src/`/`test/` changes (implementation deferred to a separately-planned Phase 19).

### Observations

- **Decision-only ADR → `/build-plan`, not `/tdd-plan`.**
  The operator chose to record decisions and defer all code to Phase 19, so the plan has a docs-only Build Order, no test cycles.
- **Per-component decisions recorded:**
  (A) foreground widget shrinks to background-agents-only;
  (B) conversation viewer replaced by native session navigation (remove the bespoke `ConversationViewer`);
  (C) `/agents` menu dissolved — drop the creation wizard, drop/deprioritize the agent-types editor, re-home running-agent visibility onto the widget + session navigation, extract settings to a focused `/subagents:settings` command;
  (D) distribution = keep surviving UI in-core (substitutable, _not_ extracted to `@gotgenes/pi-subagents-ui`).
- **Key SDK finding — `switchSession`.**
  `@earendil-works/pi-coding-agent@0.79.1` exposes `ExtensionActions.switchSession(sessionPath, { withSession })`.
  It is a _full active-session takeover_ (fires `session_before_switch`/`session_shutdown`, invalidates the current context), and the switched-to session is interactive (`ReplacedSessionContext.sendUserMessage`).
  A read-only alternative exists: `loadEntriesFromFile`/`parseSessionEntries` render a transcript without switching.
  These tensions are recorded as Phase 19 spike gates rather than pretend-resolved — the ADR commits to the _direction_ (native session machinery over a bespoke renderer), not the _mechanism_.
- **Operator-raised open questions (now Phase 19 entry criteria):** root-continuity during a session switch, view-only vs interactive, parallel-agent navigation gesture, settings command namespace, and confirming the creation-wizard's value is covered by "generate via a Pi agent" before deleting it.
- **Release:** ship independently — Phase 18 carries no `Release:` batch tag; this issue completes the phase.
- **Numbering:** plan `0427`, ADR `0004` (next free in `docs/decisions/`).
