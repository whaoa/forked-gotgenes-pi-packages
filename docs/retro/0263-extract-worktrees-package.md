---
issue: 263
issue_title: "Extract worktree isolation to @gotgenes/pi-subagents-worktrees"
---

# Retro: #263 — Extract worktree isolation to @gotgenes/pi-subagents-worktrees

## Stage: Planning (2026-05-29T17:00:46Z)

### Session summary

Produced a cross-package plan (`docs/plans/0263-extract-worktrees-package.md`) for Phase 16 Step 3 of ADR 0002: create `@gotgenes/pi-subagents-worktrees` implementing the `WorkspaceProvider` seam (#262, already landed and wired provider-first in `Agent.run()`), then evict the legacy worktree path and the `isolation` axis from the core.
The plan has nine TDD cycles split into Track A (build the new package) and Track B (two `feat!` core-eviction commits), plus root-config registration and docs.

### Observations

- The `WorkspaceProvider`/`Workspace` seam already exists; #262 is closed and `Agent.run()` already consults a provider provider-first with a legacy `worktree` fallback.
  This issue is purely "build the consumer + delete the fallback," which is smaller than the issue text implies.
- Three design decisions were resolved via `ask_user`: (1) opt-in is **per-agent via package config** (a `worktreeAgents` list keyed off `WorkspacePrepareContext.agentType`), (2) worktree-creation failure **throws and fails the run** (preserves the old strict `WorktreeIsolation.setup()` semantics), (3) the provider registers **once at extension init** (not per-session), relying on Pi's deterministic `settings.json` load order.
- The user explicitly flagged two constraints mid-session: the new package must be added to `.pi/settings.json` like the others, and Pi's `settings.json` order is deterministic (first-listed loads first) — so the new package is listed **after** `pi-subagents` and registration-at-init is safe.
  Both are captured in the plan.
- This is the **first intra-repo `@gotgenes/*` package import** — the new package imports seam types + `getSubagentsService` from `@gotgenes/pi-subagents`.
  Plan wires it as `workspace:*` devDep + peerDep range; flagged in Risks since no existing package does this.
- `service.ts` already carried a comment that "#263 adds named re-exports when it imports them" — so Step 1 adds `Workspace`/context/result type re-exports (currently only `WorkspaceProvider` is named).
- Core eviction must be **two type-coherent commits**: removing the tool-facing `isolation` axis (`SpawnExecution`/`AgentInvocation` field removal breaks all downstream object literals at once), then deleting the legacy worktree wiring + modules. `AgentSpawnConfig.isolation` is left optional after Step 7 so Step 7 type-checks, then removed in Step 8.
- Label note: the issue carries `pkg:pi-permission-system` **and** `pkg:pi-subagents`, but the content does not touch the permission system.
  Treated as cross-package (new package + core + root config) and placed in top-level `docs/plans/`; the `pi-permission-system` label appears incongruent.
- Confirmed no regression for no-provider children: `agent-runner.ts` uses `effectiveCwd = options.context.cwd ?? snapshot.cwd`, so a `undefined` cwd already falls back to the parent cwd today.

## Stage: Implementation — TDD (2026-05-29T17:32:42Z)

### Session summary

Executed the first three TDD cycles, then paused.
Steps 2–3 landed and are green on `main`: the new `@gotgenes/pi-subagents-worktrees` package scaffold with the git-plumbing lift-and-shift (`worktree.ts` + migrated `worktree.test.ts`, 11 tests) and the `worktreeAgents` config loader (`config.ts` + `config.test.ts`, 7 tests).
Step 1 (re-export seam types from pi-subagents `service.ts`) and Step 4 (the `WorkspaceProvider` implementation, written and green under vitest) were reverted; remaining steps (5–9, plus the eviction) are deferred behind prerequisite issue #270.

### Observations

- **Blocker (the headline):** the worktrees package must `import { getSubagentsService, type WorkspaceProvider } from "@gotgenes/pi-subagents"`, but pi-subagents is not type-consumable from a sibling package.
  Three compounding causes: (1) `exports["."]` points at a non-existent `./src/service.ts` (real file: `./src/service/service.ts`); (2) the public entry uses the internal `#src/*` alias, which a consumer's `tsc` resolves against the *consumer's* config; (3) `tsconfig` `paths` are program-global (collide with pi-subagents' own `#src` — both packages have a `debug.ts`), and tsc won't resolve package.json `imports` `.ts` targets.
  Filed as prerequisite **#270**; `/plan-issue`'s "first intra-repo package import" risk note proved accurate.
- **Decision (scope):** rather than expand #263 to re-package pi-subagents (would introduce the repo's first build step, mixed concerns), split the packaging work into #270 and pause #263.
  The committed Steps 2–3 are prerequisite-independent and were kept; Step 1's re-exports were dropped because their exact shape depends on #270's chosen fix.
- **Architectural note:** importing pi-subagents source contradicts the repo's own composition rule (code-design skill: prefer the event bus / `Symbol.for()` service; `pi-permission-system` never imports `@gotgenes/pi-subagents`).
  If #270 cannot make the source cleanly consumable, the fallback for #263 is a local seam contract accessed via the published `Symbol.for("@gotgenes/pi-subagents:service")` global.
  Flagged in the plan's new Status section.
- **`@types/node` quirk:** the new package needed `"types": ["node"]` in its `tsconfig.json` for node built-ins / `process` to resolve, even though `pi-session-tools` (identical otherwise) does not.
  Auto type-discovery did not kick in for the new package; the explicit `types` is the minimal fix and avoids adding an unused dep just to trigger transitive discovery.
- **Latent bug found:** pi-subagents `exports["."]` has always pointed at the wrong path; harmless to date because nothing imports the package by name.
  Captured in #270.
- **Pre-completion review:** not dispatched — the implementation was paused before completing all steps, so the pre-completion protocol does not apply yet.
  It will run when #263 resumes and finishes.
- **Remaining work on resume:** Step 1 (re-exports, contingent on #270), Step 4 (`WorkspaceProvider` impl), Step 5 (extension entry), Step 6 (settings + release-please registration), Steps 7–8 (core eviction, breaking), Step 9 (docs).
