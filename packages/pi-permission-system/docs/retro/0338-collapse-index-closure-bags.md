---
issue: 338
issue_title: "Collapse the index.ts closure bags into object references"
---

# Retro: #338 — Collapse the `index.ts` closure bags into object references

## Stage: Planning (2026-06-06T00:00:00Z)

### Session summary

Produced the implementation plan for Phase 4 Step 5 (Track B): collapsing the `index.ts` adapter closures into direct collaborator references now that Steps 2–4 made config a store, the logger an injectable object, and `PermissionManager` / `SessionRules` single shared instances.
The plan reshapes the deps interfaces on `ConfigStore`, `PermissionForwarder`, `PermissionPrompter`, the RPC handlers, the command controller, and `PermissionSession`, unifying all logging on the single `SessionLogger` object via new narrow `ReviewLogger` / `DebugReviewLogger` seams.
Seven commit cycles (six `refactor:` consumer migrations + one `docs:` metric update), each folding the consumer interface change, its test updates, and the matching `index.ts` wiring into one commit.

### Observations

- Two design forks were surfaced via `ask_user`.
  Decision 1: the logger's `getConfig` and `notify` forward-reference closures stay as idiomatic forward-reference closures (the pi-subagents pattern) — no setter methods, objects instantiated complete.
  Decision 2: include `ConfigStore` and `PermissionForwarder` in the deps-shrinking scope (the issue's step-2 list omitted them, but their closures must collapse to hit the target).
- The roadmap's "≤ 8" target for `index.ts` is not reachable under the no-setter direction: the two logger cycle closures are a permanent idiomatic floor.
  Realistic budget after this step is 11 (6 `pi.on` + 2 `toolRegistry` + 2 logger cycle + 1 transitional `canRequestPermissionConfirmation`), dropping to 10 after Step 6 ([#339]).
  The plan updates the architecture metric to 20 → 11 with a budget breakdown rather than leaving the optimistic ≤ 8.
- `canRequestPermissionConfirmation` is deliberately left as a closure: collapsing it would require injecting `subagentRegistry` into `PermissionSession` only to extract it again in Step 6's `PromptingGateway`.
  Avoided that churn.
- Forwarder cleanup is a genuine win beyond closure removal: merging the duplicated top-level `writeReviewLog` with the io `logger` into one `logger` retires the [#316] duplication.
- Verified no import cycle (`yolo-mode` imports only `extension-config` + `types`; `config-store` does not import the forwarder) and that `ConfigStoreLogger` / `ForwardedPermissionLogger` are referenced only in historical plan/retro docs, not in `.pi/skills/`.
- Largest single cycle is the forwarder + io-logger rename (cycle 4): only 4 internal `io.ts` call sites, but ~28 `writeReviewLog` references in `permission-prompter.test.ts` make cycle 2 the heaviest test-churn step.

[#316]: https://github.com/gotgenes/pi-packages/issues/316
[#339]: https://github.com/gotgenes/pi-packages/issues/339
