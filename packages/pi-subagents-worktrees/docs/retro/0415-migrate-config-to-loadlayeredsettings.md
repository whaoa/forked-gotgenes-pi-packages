---
issue: 415
issue_title: "Migrate pi-subagents-worktrees config loader to loadLayeredSettings"
---

# Retro: #415 — Migrate pi-subagents-worktrees config loader to loadLayeredSettings

## Stage: Planning (2026-06-16T18:30:00Z)

### Session summary

Planned the consumer-side migration of `pi-subagents-worktrees/src/config.ts` to the shared `loadLayeredSettings` helper published by `@gotgenes/pi-subagents/settings`.
Confirmed the prerequisite from [#380] is satisfied: the helper and the `./settings` subpath shipped in pi-subagents v16.4.0 (tag present, CHANGELOG confirms).
Scoped the change to a single package despite two `pkg:*` labels, since only worktrees code changes.

### Observations

- Despite `pkg:pi-subagents` and `pkg:pi-subagents-worktrees` labels, pi-subagents itself does not change — the helper is already published — so this is a single-package plan filed under `packages/pi-subagents-worktrees/docs/plans/`.
- The only observable behavior change is the malformed-file warning wording: the local loader says `Ignoring malformed config`, the shared helper says `Ignoring malformed settings` (fixed wording, same `[pi-subagents-worktrees]` label via `warnLabel`).
  This is stderr text, not an API/return/default change, so it is not breaking — but `config.test.ts` asserts the old text and must update.
- Worktrees currently resolves `@gotgenes/pi-subagents@15.0.1` (no `./settings`) in its nested `node_modules`; the plan bumps the peer/dev floor to `16.4.0` and requires `pnpm install` in the same commit so the new import resolves.
- Folded the dep bump, `pnpm install`, `config.ts` rewrite, docstring update, and test-assertion update into one TDD cycle/commit — the import will not resolve and the module will not compile mid-change otherwise.
- Author is the operator (`gotgenes`) and the proposed change is unambiguous, so the `ask-user` gate was skipped.
