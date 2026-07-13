---
issue: 573
issue_title: "[FEATURE REQUEST] Keybinds for approve/deny/deny with reason"
---

# Retro: #573 — Inline keybind permission dialog

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Planned Phase 11 Step 4: an inline `ctx.ui.custom<PermissionPromptDecision>` permission dialog with `y`/`s`/`n`/`r` hotkeys, gated on `ctx.mode === "tui"` with the `select`/`input` flow preserved for RPC (the #519 constraint).
The design splits a pure decision model (`permission-prompt-decision.ts`) from a thin TUI component (`permission-prompt-component.ts`), adds a default-on `doublePressToConfirm` config toggle, and makes deny-with-reason a mandatory inline editor sub-step with back-navigation.
Committed the plan; no follow-up issues filed (deferred items are unfiled by design).

### Observations

- This is a third-party issue (author `Hex4C` ≠ `gotgenes`), but it was already scheduled in the operator's own roadmap (Phase 11 Step 4), so the `ask-user` direction gate largely confirmed the roadmap design.
- The operator extended the raw request in two rounds of `ask-user`: (1) double-press-to-confirm on **all four** hotkeys, a **default-on** config toggle, modeled on pi-ask's pure `resolveReviewShortcutDoublePress`; (2) deny-with-reason reason is **mandatory** (empty rejected), `esc` = back to the decision list.
- Keybinding scheme resolved to the roadmap's `y`/`s`/`n`/`r` (over the issue's `y`/`A`/`n`/`tab`) — avoids `tab` (a navigation key) and uses mnemonic lowercase.
- Tension noted and accepted: #573's motivation was *fewer* keypresses, but the operator chose double-press default-on for safety; the operator's call overrides the original motivation.
- Enter semantics decided by the planner (not re-asked): enter confirms the highlighted option in a single press; the double-press toggle governs only the **letter-hotkey** fast path.
  Navigate-then-enter is already two deliberate keystrokes.
- Classified **non-breaking** (`feat:`, not `feat!:`): the TUI interaction changes on upgrade, but the `PermissionPromptDecision` contract, gate outcomes, and config surface are additive/unchanged; the new toggle defaults on and is disableable.
- SDK verification: `ctx.ui.custom` renders inline by default and works only in TUI (`hasUI` is also true for RPC), so the gate is `ctx.mode === "tui"`, not `hasUI`. `config-modal.ts` is the in-package `ctx.ui.custom` precedent; `@earendil-works/pi-tui` is already a `devDependency`.
- `requestPermissionDecisionFromUi` is **retained** as the RPC fallback (lift-and-shift), so no consumer/doc breaks — only the injected seam re-points to a new `requestPermissionDecision` dispatcher.
- `doublePressToConfirm` threaded as a live **getter** (not an activation snapshot) so the `/permission-system` settings-modal toggle takes effect on the next prompt.
