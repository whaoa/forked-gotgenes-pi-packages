---
issue: 437
issue_title: "pkg:pi-permission-system — system-prompt-sanitizer strips the entire Available tools section from the wire prompt"
---

# Retro: #437 — system-prompt-sanitizer strips the entire Available tools section from the wire prompt

## Stage: Planning (2026-06-19T00:00:00Z)

### Session summary

Planned the fix for `sanitizeAvailableToolsSection` deleting the whole `Available tools:` section: narrow it to the allowed tools (Option B — line-filter the lines Pi already rendered into `event.systemPrompt`) instead of removing it, and recompute/return a byte-stable override every turn.
The decision survived two `ask_user` rounds: the first chose "retire the sanitizer, read Pi's rebuilt prompt via `pi.getSystemPrompt()`", which a source investigation then disproved (no such API); the operator then weighed prompt-cache cost and chose Option B for byte-stability from turn 1.

### Observations

- **Source investigation drove the design**, not the issue text.
  Verified in `@earendil-works/pi-coding-agent@0.79.1`: `setActiveToolsByName` rebuilds the prompt (`agent-session.js:543`); a returned `{ systemPrompt }` clobbers it (`agent-session.js:812`); `ExtensionAPI` has **no** `getSystemPrompt` (`loader.js:149` + type), and the per-event `ctx.getSystemPrompt()` is overridden to the stale snapshot (`runner.js:749`); `ToolInfo` omits `promptSnippet` (`types.d.ts:1060`), so Pi's lines can be line-filtered but not regenerated.
- **The original plan was invalid** — `pi.getSystemPrompt()` does not exist; that killed the "retire the module" hypothesis from issue [#437]'s own body and forced the narrowing approach.
- **Cache-stability is the load-bearing requirement.**
  The override is byte-stable across turns because `event.systemPrompt`'s non-tool regions are tool-independent and `narrow(.., allowed)` is idempotent, so `narrow(defaultProse, allowed) === narrow(narrowedProse, allowed)`.
  This is encoded as an explicit test invariant at both the sanitizer and handler levels.
- **Gate removal is a justified consequence, not scope creep.**
  `CacheKeyGate.runIfChanged` returns `undefined` on a hit (`cache-key-gate.ts:21`); with `return promptResult ?? {}` that resets Pi's base to a skill-**unfiltered** prompt — a latent per-turn skill leak.
  Recompute-and-return-every-turn fixes it and makes `activeToolsGate` / `promptStateGate` / `CacheKeyGate` + `before-agent-start-cache.ts` dead; all deletions verified contained (only `before-agent-start.ts` calls `runIfChanged`).
- **Classified breaking** (`fix!:` + `BREAKING CHANGE:`), confirmed via `ask_user`: the wire system prompt changes on upgrade (the `Available tools:` section reappears, narrowed).
- **Deferred:** the fully-frozen end-state (return `{}` forever) needs an upstream Pi skill-exclusion hook + a live prompt getter — logged as an Open Question / future upstream tracking issue, not in scope.
- **Doc nuance:** `docs/architecture/v3-architecture.md` is a superseded design-era snapshot and is intentionally left unupdated; the live `architecture.md` module listing and `docs/configuration.md` hook wording are updated.
  The Phase-5 history line in `architecture.md` mentioning `CacheKeyGate` is past-tense record and stays.

## Stage: Implementation — TDD (2026-06-19T21:00:00Z)

### Session summary

Executed all three planned TDD cycles: (1) `refactor:` dropped the memoization gates (`activeToolsGate`/`promptStateGate`/`CacheKeyGate`/`before-agent-start-cache`) and made `AgentPrepHandler` recompute and return the override every turn; (2) `fix!:` rewrote `sanitizeAvailableToolsSection` to narrow the `Available tools:` section per-bullet instead of deleting it; (3) `docs:` updated `configuration.md`, `architecture.md`, and the package `SKILL.md`.
Test count went 2033 → 2029 (net `-4`: removed the gate/cache test files and gate-reset assertions, added narrowing, per-turn skill-filter, and byte-stability regressions).
`check`, root `lint`, full `test`, and `fallow dead-code` all green; pre-completion reviewer returned PASS.

### Observations

- **Documented deviation — `getPolicyCacheStamp` removal.**
  The removed prompt-state cache key was the sole production consumer of `getPolicyCacheStamp`, so the now-dead public method was removed from `PermissionResolver` and `ScopedPermissionManager` (the manager's internal policy cache uses `loader.getCacheStamp` directly, untouched).
  Folded into the Step-1 `refactor:` commit with a note; touched `permission-resolver.ts`, `permission-manager.ts`, and their tests/fixtures beyond the plan's listed files.
  `fallow dead-code` confirmed no orphans.
- **`extractToolBulletName` accepts colon-optional bullets** (`/^\s*-\s+([A-Za-z0-9_-]+)/`) so both the real Pi format (`- read: …`) and the test helper format (`- read`) classify correctly; non-bullet boilerplate returns `null` and is always kept.
- **Byte-stability is asserted two ways**: at the sanitizer level (`narrow(full).prompt === narrow(narrowed).prompt` and `narrow(narrowed) === narrowed`) and at the handler level (effective wire prompt identical across the turn-1 full / turn-2 narrowed drift).
  Both stayed green through Step 2, confirming the cache invariant holds.
- **Edit-tool friction**: removing the `getPolicyCacheStamp` describe block left an orphaned `})`; the autoformatter surfaced the parse error immediately and a one-line tail fix resolved it.
  No shipped defect.
- **Pre-completion reviewer: PASS** (no WARN).
  Confirmed the Step-2 narrowing does not regress Step-1's per-turn skill-filter invariant (pinned by the `filters a denied skill ... on every turn` test) nor the #385 restrict-only invariant.

[#437]: https://github.com/gotgenes/pi-packages/issues/437
