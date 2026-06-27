---
issue: 481
issue_title: "pi-permission-system: env-var prefix and bash -c/eval bypass bash command-pattern rules"
---

# Retro: #481 — pi-permission-system: env-var prefix and bash -c/eval bypass bash command-pattern rules

## Stage: Planning (2026-06-26T00:00:00Z)

### Session summary

Produced a numbered TDD plan for two bash command-pattern bypasses reported by a third-party author (`0xbentang`): a leading `variable_assignment` env-var prefix defeating rule matching, and opaque `-c`/`eval` payloads riding a permissive `allow`.
Confirmed direction and scope with the operator via `ask_user` (the issue is third-party, so the direction gate was required).
Filed follow-up [#490] for other indirection wrappers and committed the plan at `packages/pi-permission-system/docs/plans/0481-strip-env-prefix-floor-opaque-bash-wrappers.md`.

### Observations

- Both bypasses are fixed in this plan, but via two different mechanisms decided with the operator:
  - Part 1 strips the env-var prefix from the emitted command unit (re-targets matching at the real command).
  - Part 2 floors opaque shell wrappers (`bash`/`sh`/`dash`/`zsh`/`ksh -c`, plus `eval`) to at least `ask` rather than re-parsing the payload.
- The operator explicitly preferred the floor-to-`ask` approach over the issue's "ideally re-parse `-c`/`eval`" suggestion — it is fail-safe, far simpler, and avoids the path-candidate asymmetry that re-parsing would leave (inner paths would still miss the `path`/`external_directory` surfaces).
- Floor semantics: `allow` clamps up to `ask` with an `<opaque-bash-wrapper>` sentinel; an explicit `deny` rule still wins.
  Mirrors the existing `<unparseable-bash-command>` sentinel ([#452]).
- Classified `fix:` not `fix!:` — it only tightens decisions (closes a bypass), never weakens one; the old behavior was the bug, so there is no intended behavior to preserve.
- Wrapper set scoped to inline shells + `eval`; other indirection wrappers (`sudo`, `env VAR=x cmd`, `xargs`, `find -exec`, `time`, `nohup`, `timeout`, `nice`) deferred to [#490].
- Implementation note for the next stage: Part 1 needs `startIndex` added to the minimal `TSNode` interface (`parser.ts`) to slice verbatim text; this makes it a required field, so the `makeNode` literal builder in `test/access-intent/bash/node-text.test.ts` must set `startIndex: 0` in the same commit (typecheck coupling).
- The metamorphic totality test (`bash-command-metamorphic.test.ts`) wraps with a `cd` prefix, not `bash -c`, so the opaque floor does not disturb it.
- `#481` is not in the architecture roadmap (Phase 6 is complete) → ship independently.

## Stage: Implementation — TDD (2026-06-26T22:30:00Z)

### Session summary

Implemented all three planned TDD steps across two `fix:` commits and supporting docs: stripping the leading `variable_assignment` prefix from each bash command unit, and flooring opaque `-c`/`eval` wrappers (`bash`/`sh`/`dash`/`zsh`/`ksh -c` + `eval`) from `allow` to `ask` with a `<opaque-bash-wrapper>` sentinel.
Test count went from 2124 → 2145 (+21) in `pi-permission-system`; full suite, `pnpm run check`, root lint, and `pnpm fallow dead-code` all green.
Pre-completion reviewer returned PASS.

### Observations

- Established the green baseline by fixing two pre-existing lint failures first (a separate `docs:` commit): the `0481` plan wrapped its `[#NNN]` reference links in backticks (MD053 unused-definition), and the archived `phase-6` history doc pointed at a `#directory-organization-forward-looking` anchor that was consolidated into `## Module structure` (MD051).
- Step 1 coupling held as the plan predicted: adding the required `startIndex` field to `TSNode` forced the `makeNode` literal builder in `node-text.test.ts` to set `startIndex: 0` in the same commit.
- The opaque detector (`isOpaqueWrapperCommand`) matches the `command_name` basename against a shell set (`bash`/`sh`/`dash`/`zsh`/`ksh`) plus `eval`, and recognizes `-c` inside a short-flag cluster (`-c`/`-ec`/`-xc`); `grep -c` is unaffected because `grep` is not a shell.
  The detector skips the same leading `variable_assignment` prefix as `commandUnitText`, so an env-prefixed `AWS_PROFILE=x bash -c "…"` is both stripped and flagged.
- The `eslint` pre-commit hook auto-fixed one optional-chain in step 2 (`!child || !child.isNamed` → `!child?.isNamed`); `biome` separately flagged a second optional-chain in `commandUnitText` that eslint left, landed as a `style:` commit.
- Minor plan deviation: the plan listed a `program.ts` `commands()` JSDoc update; I initially updated only the `collectCommands` JSDoc, then added the `commands()` JSDoc in a follow-up `docs:` commit.
- Pre-completion reviewer: PASS.
  Reviewer warnings (addressed in a follow-up `docs:` commit, not deferred): the README "Fails closed" bullet and the `package-pi-permission-system` skill Debugging section named only `<unparseable-bash-command>` and now also mention the sibling `<opaque-bash-wrapper>` sentinel.

[#452]: https://github.com/gotgenes/pi-packages/issues/452
[#490]: https://github.com/gotgenes/pi-packages/issues/490
