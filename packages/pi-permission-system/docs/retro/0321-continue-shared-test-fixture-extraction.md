---
issue: 321
issue_title: "Continue shared test-fixture extraction for the largest clone families"
---

# Retro: #321 — Continue shared test-fixture extraction for the largest clone families

## Stage: Planning (2026-06-03T21:30:00Z)

### Session summary

Produced a numbered build plan (`docs/plans/0321-continue-shared-test-fixture-extraction.md`) for migrating the four largest remaining test clone families onto the shared `test/helpers/` fixtures.
Grounded the four families in a live `fallow dupes` run (133 clone groups, 7.6%) and confirmed by reading each file that all four already import the shared fixtures — the remaining clones are duplicate local factory definitions plus repeated override expressions, not unmigrated files.
This is a pure test refactor (no `src/` changes), so the next stage is `/build-plan`, with migrate → full-suite-green → commit cycles.

### Observations

- One `ask_user` design decision: how aggressively to extend the shared fixture API.
  User chose **both** — consolidate the duplicate factories AND add convenience shortcuts (`makeSurfaceCheck`, `makeBashCommandCheck`, `makeDenialDescriptor`, `makePathDispatchResolver`, a `makeGateRunner` `resolveResult` option, and a `makeHandler` `tools` shortcut) to hit the sub-6% target.
- Key correctness risk identified: the local `makeSession` in `external-directory-integration.test.ts` diverges from the shared one in two defaults (`getInfrastructureReadDirs` → `[]` vs `["/test/agent", …]`; `checkPermission` → deny vs neutral allow).
  Analysis shows both differences are moot for that file's tests (explicit `checkPermission` everywhere; infra dirs never intersect test paths), but the full-suite green gate after the ext-dir step is the verification.
- Applied the code-design "structural reasons before extracting duplication" heuristic to fence off genuine per-test intent that must stay inline: the per-agent `agentAwareCheck`, `toolName`-alias event literals, multi-condition path dispatch, and the bash regex/pattern values.
- Discovered `makeTcc()` already defaults `input` to `{ command: "cat .env" }`, so many `bash-path.test.ts` clones collapse to a bare `makeTcc()` with no new helper.
- The production refactors this step is "best sequenced after" ([#314], [#317]–[#320]) have all landed — the shared fixtures already import their outputs (`PermissionResolver`, `GateRunner`, the two pipelines, `GateDecisionReporter`), so no soft dependency blocks the work.
- Carried forward the [#288] recurring friction as an explicit per-step instruction: grep each removed symbol before committing, because a stale value import passes `tsc` and the `lint` exit code but is a biome warning.
- Scope guard: `external-directory-session-dedup.test.ts` shares the local-`makeSession` clone family but is the fifth file, outside the issue's named four; flagged as a conditional follow-up issue if the sub-6% target is missed, not scope creep here.

[#288]: https://github.com/gotgenes/pi-packages/issues/288

## Stage: Implementation — Build (2026-06-03T11:40:00Z)

### Session summary

Completed all 5 build steps from the plan: runner gate migration (Step 1), bash-path gate migration (Step 2), tool-call handler migration (Step 3), external-directory integration migration (Step 4), and docs refresh (Step 5).
Test count held steady at 86 files / 1834 tests throughout — pure refactor, no assertions changed.
Pre-completion reviewer returned PASS.

### Observations

- **Step 1** Fixed a TS2783 (`state` specified twice) in the `makeSurfaceCheck` implementation in `handler-fixtures.ts`; resolved by removing the redundant explicit `state: base.state` before the spread, letting `...base` cover it.
  One extra check+fix cycle.
- **Step 2** A pre-commit eslint hook reformatted `gate-fixtures.ts` on the first commit attempt (exit 1); re-staged the auto-fixed file and committed cleanly.
- **Steps 3–4** `makeSurfaceCheck` and `makeExtDirCheck` (a local thin wrapper in `external-directory-integration.test.ts`) replaced the surface-dispatch boilerplate cleanly; no assertion changes needed.
  The shared `makeSession` default `getInfrastructureReadDirs` (`[\u201c/test/agent\u201d, ...]`) did not intersect any ext-dir test path, confirming the planning analysis.
- **Target miss**: duplication landed at 6.6% (122 clone groups), not under 6%.
  The remaining gap is the `external-directory-session-dedup.test.ts` family (local `makeSession`/`makeToolRegistry` clones across ext-dir + session-dedup + handler-fixtures), which was out of the four-file scope.
  A follow-up issue should be filed per the plan’s Open Questions.
- No stale imports or `GateDescriptor`/`makeCheckPermission`/`makeDenialContextDescriptor` leaks found at any step.
- **Reviewer verdict**: PASS — all deterministic checks green, new helpers documented in `SKILL.md`, architecture roadmap updated.
[#314]: https://github.com/gotgenes/pi-packages/issues/314
[#317]: https://github.com/gotgenes/pi-packages/issues/317
[#320]: https://github.com/gotgenes/pi-packages/issues/320
