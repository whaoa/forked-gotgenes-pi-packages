---
status: accepted
date: 2026-06-18
---

# 0004 — Reconsider the UI direction from first principles

## Status

Accepted.
Completes Phase 18 (reconsider the UI) and gateways Phase 19 (implement the recorded decisions).
Decision-only: this ADR changes no runtime code.
The inherited UI stays live until Phase 19 acts on these decisions.

## Context

Phase 18's spine (Steps 1–7, #420 through #426) disentangled the activity tier from the core.
The core now owns all run state in one place (`SubagentState`), the widget self-drives from lifecycle events, the LLM-facing `subagent` tool no longer depends on the widget, and the public event contract's declared channels equal its emitted channels.
The UI is therefore a pure reactive consumer of the broadcast-plus-query surface — _substitutable_.

This final step decides the UI's _direction and distribution_, not whether substitution is possible.
The goal is **substitutable, not optional**: a human needs some surface, but the specific UI is replaceable — the way Pi ships a default TUI built on the same public API any extension targets.
The disentangled core stays byte-for-byte identical whether or not a given UI consumer is installed (the composition invariant), so a replacement UI is a downstream concern even though _some_ UI is not.

Unlike the worktrees provider seam (generative, rationed — one provider the core consults), the UI is an observational consumer (unlimited, the core never waits on it).
That asymmetry is why packaging the UI is the secondary question and decoupling it was the real win.

Three operator-framed concerns shape the per-component judgment.

1. **Foreground progress is already shown by the tool call.**
   In foreground the `subagent` tool's inline `onUpdate` stream renders progress well; the above-editor widget duplicates it.
2. **Background agents have no tool-call display.**
   When agents run in the background there is no inline stream, so _something_ must indicate their state — and multiple subagents can run in parallel, so that surface must represent N concurrent agents at once.
3. **Operator visibility into a subagent's session is a distinct, richer need.**
   "Switch into a subagent's session, scroll/read it, switch between subagents, and exit back to root" is a navigation interaction, not a live overlay.
   The core already persists each child as a standalone Pi session JSONL at `Subagent.outputFile`, and `Subagent.messages` exposes the full history — so the data was never the limit; the bespoke, width-capped `ConversationViewer` overlay was.

### Relevant Pi SDK surface

Verified against `@earendil-works/pi-coding-agent@0.79.1`:

- `ExtensionActions.switchSession(sessionPath, { withSession })` switches the **active** session to a different session file.
  It is a full active-session takeover: it fires `session_before_switch` / `session_shutdown`, invalidates the current session context (`setBeforeSessionInvalidate` exists for host-owned UI teardown), and returns `{ cancelled }`.
  The switched-to session is fully interactive — `ReplacedSessionContext` exposes `sendUserMessage`.
- `session-manager` exports `loadEntriesFromFile(filePath)` / `parseSessionEntries(content)`, which read a session file's entries without switching — the read-only alternative to a full takeover.

## Decision

Judge each UI component on the first principles above, then record the distribution.

### A — Foreground widget: shrink to background agents only

The above-editor widget duplicates the foreground tool's inline `onUpdate` stream.
The widget survives **only** as the background-agent status surface (concern 2): foreground runs suppress it, the inline stream is authoritative there, and the background surface keeps the widget's existing per-agent tree so it represents N parallel agents at once.
The change is _when_ the widget shows (background-only), not _what_ it shows.

### B — Conversation viewer: replace the bespoke overlay with native session navigation

Remove the bespoke `ConversationViewer` overlay.
Operator visibility (concern 3) is served by Pi's own session machinery applied to the already-persisted child session file, not a hand-rolled transcript renderer — the recursive-Pi insight applied to `Subagent.outputFile`.

The illustrative call shape (Phase 19, not final):

```typescript
// "View running agents" → pick a child → switch into its persisted session
const child = manager.getRecord(id);
if (child?.outputFile) {
  await ctx.switchSession(child.outputFile);
  // operator reads/scrolls in Pi's native viewer; a later switch returns to root
}
```

This is Tell-Don't-Ask (hand Pi the session path; Pi owns the viewer) and keeps the core free of transcript-rendering code.

This decision records the _direction_ (native session machinery over a bespoke renderer), not the _mechanism_.
`switchSession` is a full active-session takeover and is interactive, so the operator UX is gated on a Phase 19 spike that chooses between (i) true `switchSession` round-trips and (ii) a read-only transcript built from `loadEntriesFromFile` that renders Pi-standard entries without leaving the root session.
See "Phase 19 entry criteria."

### C — `/agents` menu: dissolve the monolithic command into focused surfaces

The single `/agents` command bundles four unrelated jobs; split them, and do not keep all in one command.
Managing agent _definitions_ through the menu earns no keep — creating or editing agents is better done with other tools (directly in Pi, or a real text editor / IDE).

- **Create new agent (wizard)** → **remove.**
  An operator generates a new agent `.md` by asking a Pi agent directly (more capable than a fixed wizard) or by writing the file in an editor.
- **Agent types (list + config editor)** → **remove.**
  Viewing and editing agent definitions is better served by opening the `.md` files directly in an editor/IDE.
- **Running agents (visibility)** → **keep the responsibility, re-home it.**
  _Something_ must own running-agent visibility; it moves onto the background widget (Decision A) plus the native session navigation (Decision B), not a bespoke in-menu overlay.
- **Settings (concurrency / max turns / grace turns)** → **extract to a focused command** (e.g. `/subagents:settings`).
  Some value, but it does not belong bundled with agent management.

### D — Distribution: keep the surviving UI in-core (substitutable, not extracted)

The spine already made the UI substitutable; a replacement UI is a downstream concern that targets the public broadcast-plus-query surface.
The surviving UI — the background widget, a focused settings command, and the session-navigation glue — **stays in-core** as a reactive consumer.
Extraction to a separate `@gotgenes/pi-subagents-ui` package is **not** chosen now.

This answers the issue's headline question — the UI's _distribution_ — with "keep in core, substitutable," recorded explicitly rather than left implicit.
Extraction remains an available future option precisely because the composition invariant holds: the core is byte-for-byte identical with or without a given UI consumer.
It would be revisited if a second, materially different UI consumer appears, or if the in-core UI starts to pull SDK or rendering concerns back into core modules.

## Consequences

- The inherited UI is no longer preserved by default; each component now has a recorded fate (shrink / replace / dissolve) motivated by the first principles, not by inheritance.
- Phase 18 is complete.
  This ADR gateways Phase 19, which implements the decisions (background-only widget, native session navigation, `/agents` decomposition, `/subagents:settings` extraction) under its own plan and issues.
- No interim regression: this ADR removes nothing.
  The widget, the `ConversationViewer`, and the full `/agents` menu stay live until Phase 19 replaces them.
- Phase 19 must preserve the spine's invariants when it acts on these decisions: the runtime holds zero UI state (#422), the widget is a reactive consumer with no inbound calls from core spawn tools (#423), the LLM tool depends only on manager/runtime/settings/registry (#424), and declared event channels equal emitted channels with no vacant hook (#425).
  These are pinned today by the existing observer/widget/event-contract suites, which Phase 19 inherits.

## Phase 19 entry criteria

The following are open and must be resolved by a Phase 19 spike before committing to a mechanism; they are deliberately not decided here.

- **Root-continuity during a session switch.**
  `switchSession` invalidates the current session context — does the root's in-flight turn survive a switch-out-and-return, and what is the correct "return to root" gesture?
  Resolve before committing to true `switchSession` round-trips.
- **View-only vs interactive.**
  A switched-to child session is interactive (`sendUserMessage`).
  Decide whether steering a child from its own session is desirable, or whether the viewer should be strictly read-only (favoring the `loadEntriesFromFile` transcript path).
- **Parallel-agent navigation.**
  With N background agents running, decide the operator's gesture to pick which child to view and to cycle between them — driven from the background widget, a dedicated command, or both.
- **Settings command namespace.**
  Confirm the final command name/namespace for the extracted settings surface (`/subagents:settings` vs another form) against how sibling packages register namespaced commands.

The agent create/edit surfaces are **not** open questions: both are removed (Decision C).
