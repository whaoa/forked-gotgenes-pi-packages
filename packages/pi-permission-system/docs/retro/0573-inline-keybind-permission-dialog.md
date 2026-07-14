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

## Stage: Implementation — TDD (2026-07-13T20:20:00Z)

### Session summary

Implemented the inline keybind permission dialog across 5 TDD cycles: a pure decision model (`permission-prompt-decision.ts`), the `doublePressToConfirm` config toggle, the inline `ctx.ui.custom` component (`permission-prompt-component.ts`), the mode-dispatch wiring, and the architecture-doc completion.
Test count grew from 2418 to 2455 (+37); full suite, `pnpm run check`, root lint, and `pnpm fallow dead-code` all green.

### Observations

- **Design deviation (ISP + cycle avoidance):** the plan said to widen `PermissionDecisionUi` with `custom` and put the dispatcher in `permission-dialog.ts`.
  Instead I kept `PermissionDecisionUi` narrow (`select`/`input`) and added a separate `PermissionPromptUi = Pick<ExtensionUIContext, "select" | "input" | "custom">` plus the `requestPermissionDecision` dispatcher in `permission-prompt-component.ts`.
  This avoids a `permission-dialog.ts` ↔ component import cycle and is more ISP-faithful; `permission-dialog.ts` was consequently **not** modified.
- **Tidy-first prep skipped:** the assessor's one recommended commit (a `makeStubUi` fixture) was predicated on widening the shared `PermissionDecisionUi` — the ISP deviation above made it low-value (only the 2 `local-user-authorizer.test.ts` sites broke, and they were rewritten in the wiring step anyway).
- **Config field forced call-site updates early:** making `doublePressToConfirm` a required field of `PermissionSystemExtensionConfig` broke three literal constructions (`config-modal.ts` `cloneDefaultConfig`, `config-modal.test.ts`, `config-reporter.test.ts`), fixed in the same step-2 commit per the required-field rule.
- **Options are always `[y, s, n, r]`:** the plan's speculative "s absent" edge case does not occur — the fallback dialog always offers the session option, so the model mirrors that.
- **`matchesKey` works on raw strings** (verified via a throwaway probe): arrows `\u001b[A/B`, `\r` enter, `\u001b` escape, `\u007f` backspace all resolve, so the component maps keystrokes without a live terminal, and the pi-ask fake-`tui`/`plainTheme`/`done` harness tests the component end-to-end.
- **Pre-completion reviewer: WARN** — one non-blocking finding: the plan asked to bump the `Inline prompt component files` health-metric row `0 → 1`.
  Deliberately **not** done: that column is the dated `Baseline (2026-07-12)` snapshot, and the already-landed Phase 11 steps 1–3 left their achieved rows' baselines untouched too (the table is recomputed at phase close, not per-step).
  Editing only this row would make the baseline column internally inconsistent; the `✅` step heading + Mermaid node are the completion markers.
