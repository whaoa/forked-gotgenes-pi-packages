---
issue: 218
issue_title: "Push SDK boundary in settings.ts (Phase 13, Step 5)"
---

# Retro: #218 — Push SDK boundary in settings.ts

## Stage: Planning (2026-05-26T17:01:55Z)

### Session summary

Produced a 3-step TDD plan to inject `agentDir: string` into `SettingsManager` and `loadSettings`, removing the only Pi SDK import from `settings.ts`.
The change is straightforward — a single parameter addition threading through constructor, free function, and boundary wiring.

### Observations

- The change is entirely mechanical: no design ambiguity, no new abstractions, no breaking public API.
- The main implementation effort is in test updates (~35 `new SettingsManager(...)` call sites plus ~15 `loadSettings(...)` calls), all requiring an `agentDir` argument.
- All test `describe` blocks that manipulate `PI_CODING_AGENT_DIR` env var can drop that scaffolding entirely, simplifying setup/teardown.
- `saveSettings` has no SDK dependency and needs no signature change — only `loadSettings` calls `globalPath()`.
