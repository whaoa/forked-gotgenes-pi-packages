---
issue: 288
issue_title: "Extract shared test fixtures to cut permission-system test duplication"
---

# Retro: #288 — Extract shared test fixtures to cut permission-system test duplication

## Stage: Planning (2026-05-31T00:00:00Z)

### Session summary

Produced a numbered migration plan for extracting duplicated test setup in `pi-permission-system/test/` into focused `test/helpers/` modules.
Grounded the clone families in a live `fallow dupes` run (122 groups, 9.1%) and confirmed the divergent `makeCheckResult` defaults across `gates/runner`, `gates/bash-path`, and `tool-call` copies.
Plan is a pure test refactor (no `src/` changes); next step is `/build-plan` since cycles are migrate → full-suite-green → commit, not red→green.

### Observations

- Three user-confirmed design decisions via `ask_user`: no co-located helper tests (transitive coverage), focused files by concern (mirror `pi-subagents/test/helpers/`), and a single neutral-default `makeCheckResult` with explicit per-call overrides.
- The divergent `makeCheckResult` defaults are the main correctness risk — `bash-path` uses `toolName: "path"`/`source: "special"`/`origin: "global"`; `runner` adds `matchedPattern: "*"`.
  Migration must pass each site's original fields as explicit overrides.
- Watch the testing-skill trap: do not annotate mock-bag factories (`makeHandler`, `makeRunnerDeps`) with the production interface, or `.mockReturnValue` access is erased.
- Keep the regression-guard import in `external-directory-integration.test.ts` — it intentionally fails the load if a message helper is removed.
- `permission-system.test.ts` is 2839 lines; only the targeted intra-file `createManager`/config clones are in scope — leave `withIsolatedSubagentEnv` and env handling untouched.
- Step 5 (lifecycle setup) and the ext-dir block's final home are flagged as open questions to settle during implementation.
- Initial `Write` hit an external-directory denial from a wrong absolute path (`/Users/chris/development/pi/pi-permission-system/...`); the repo root is `pi-packages`.
  Use repo-relative paths.

## Stage: Implementation — TDD (2026-05-31T14:45:00Z)

### Session summary

Completed all 6 migration steps from the plan: handler fixtures (Step 1), external-directory family (Step 2), gate fixtures (Step 3), manager harness (Step 4), lifecycle setup (Step 5), and docs refresh (Step 6).
Test count held steady at 71 files / 1628 tests throughout — pure refactor, no assertions changed.
Pre-completion reviewer returned WARN (resolved before shipping).

### Observations

- **Step 1** `makeCheckResult` signature change required converting positional-`state` calls in `tool-call-events.test.ts` to override-bag form with explicit `matchedPattern: "*"` where the original factory had it as a default.
  All other files used the neutral default safely.
- **Step 2** `makeToolCallEvent` in `external-directory-integration.test.ts` used `input` as a direct second argument (not wrapped); migrated all call sites to `{ input: {...} }` wrapper convention to align with the shared factory.
  No test failures.
- **Step 3** `makeCheckResult` defaults diverged across runner vs bash-path/path files; gate-fixtures introduces `makeGateCheckResult` (path defaults) alongside the neutral `makeCheckResult` from handler-fixtures to avoid verbose per-call overrides in the 20+ bash-path call sites.
- **Step 4** `CreateManagerOptions` was still used in `createManagerWithProject` in `permission-system.test.ts` after removing the local definition — needed an explicit import from the harness.
  The `TS2345` error at line 1170 (pre-existing latent type issue) was resolved as a side effect once `CreateManagerOptions` was properly imported.
- **Step 5** `makeSession` in `before-agent-start.test.ts` and `lifecycle.test.ts` have different method sets (different lifecycle phases), so only `makeCtx` was extracted.
  The 39-line fallow clone was primarily the `makeCtx` body.
- **WARN 1 resolved**: stale `PermissionGateHandler` import in `tool-call.test.ts` removed (biome lint warning, exit 0).
- **WARN 2 resolved**: `package-pi-permission-system` SKILL.md Testing section updated with `test/helpers/` layout and the divergent-default `makeCheckResult` override pattern.
- Pre-completion reviewer verdict: **WARN** (2 findings, both resolved before shipping).
