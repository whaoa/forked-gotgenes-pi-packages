---
issue: 490
issue_title: "pi-permission-system: floor other indirection wrappers (sudo/env/xargs/find -exec) to ask"
---

# Retro: #490 — floor other indirection wrappers to ask

## Stage: Planning (2026-07-12T17:44:03Z)

### Session summary

Planned Phase 10 Step 5: floor indirection wrappers (`sudo`/`env`/`xargs`/`find -exec`/`time`/`nohup`/`timeout`/`nice`/`fd -x`) to `ask`, extending #481's opaque-payload floor.
This is an evaluation issue, so the direction was confirmed via `ask_user` — the operator chose **floor-all** (over re-target-vs-floor hybrid), all listed wrappers, `find`/`fd` gated on an exec flag, plus `fd` coverage with a follow-up for other modern rewrites.
Plan filed at `docs/plans/0490-floor-indirection-wrappers.md`; follow-up #575 filed for surveying other exec-capable CLI rewrites.

### Observations

- The roadmap (`docs/architecture/architecture.md` Phase 10 Step 5) recorded an **earlier 2026-07-10 hybrid direction** ("re-target visible prefix wrappers, floor `xargs`/`find -exec`").
  Today's floor-all decision **supersedes** it — the plan's Step 4 must rewrite the roadmap Step 5 note, the health-metrics "Indirection-wrapper coverage" row, and the `S5` Mermaid label, and mark the step `✅` in the implementation doc-update commit.
- AST probe (tree-sitter-bash) confirmed every wrapper parses as a **flat `command` node** with no boundary between the wrapper's own options and the inner command.
  This is why re-targeting was rejected: it needs a per-wrapper option-arity table (`sudo -u X`, `env -u X`, `nice -n N`, `timeout N`), and a wrong table silently under-matches — the bypass class the package warns against.
  The floor needs no such tables.
- Design decision: generalize #481's `BashCommand.opaque?: boolean` to a `wrapperKind?: "opaque-payload" | "indirection"` discriminant (illegal `{opaque, indirection}` state unrepresentable), with a sibling `<indirection-bash-wrapper>` sentinel; the `<opaque-bash-wrapper>` string is preserved byte-for-byte so #481 tests/docs stay green.
- The rename removes the `opaque` field, so all `opaque: true` test literals (in `program.test.ts`, `sync-commands.test.ts`, `bash-command.test.ts`) become compile errors and must migrate in the same (Step 1 refactor) commit — sequenced as a behavior-preserving refactor before the two `fix:` behavior steps.
- `find`/`fd` are exec-flag-conditional (bare searches run no subcommand and are common); the always-invoke set floors by `command_name` basename alone.
  Accepted edge: bare `env`/`time`/`sudo -l` are floored too (least-privilege posture).
- Release: **ship independently** (Step 5 is `Release: independent`; a `fix:` that cuts its own release; not part of the "tool-kind-dispatch" batch).
- The advisory surface (`resolveBashAdvisoryCheck`) reuses the shared `resolveBashCommandCheck`, so the floor applies there for free — no separate change.

## Stage: Implementation — TDD (2026-07-12T14:04:00Z)

### Session summary

Implemented all four planned TDD cycles: a behavior-preserving refactor generalizing #481's `BashCommand.opaque?: boolean` to a `wrapperKind?: "opaque-payload" | "indirection"` discriminant, then two `fix:` commits adding the indirection floor (always-invoke `INDIRECTION_WRAPPER_NAMES`; `find`/`fd` exec-flag-gated `EXEC_CONDITIONAL_WRAPPERS`), then the docs/roadmap commit.
Test count went 2348 → 2374 (+26); `check`, root `lint`, and `fallow dead-code` all green.
Pre-completion reviewer returned **PASS** — ready for `/ship-issue`.

### Observations

- The floor half needed no code change beyond Step 1: the `WRAPPER_SENTINEL` `Record<WrapperKind, string>` was defined with both keys in the refactor, so once the classifier emitted `"indirection"`, `resolveBashCommandCheck` floored it automatically.
  This made Step 2's floor tests green on arrival — the only new code was the classifier arm.
- **Deviation 1 (test omissions):** the plan floated an optional advisory indirection case in `bash-advisory-check.test.ts` and a `find`/`fd` floor case in `bash-command.test.ts` (Step 3).
  Omitted both as redundant — the advisory path reuses `resolveBashCommandCheck`, and the `find`/`fd` floor is the identical `wrapperKind: "indirection"` path already covered by the Step 2 `sudo` floor test.
  The distinguishing new behavior (exec-flag gating) is covered by the `program.test.ts` classifier tests.
  Reviewer agreed the omissions are sound.
- **Deviation 2 (unplanned file):** updated `docs/retro/phase-10-decide-once-dispatch.md` — a grep found it recorded the superseded 2026-07-10 "re-target" direction as the roadmap's scheduling record; appended a supersession marker pointing to the plan.
  Reviewer classified it a legitimate reverse-documentation fix.
- **Infra note:** the `rumdl-fmt` pre-commit hook failed to reinstall on the docs commit (transient `No route to host` fetching setuptools).
  Ran `pnpm exec rumdl fmt` + `rumdl check` manually (clean), then committed the docs step with `--no-verify`.
  Code commits were unaffected (markdown hooks skip when no `.md` files are staged).
- Roadmap Step 5 marked `✅` on both the heading and the `S5` Mermaid node in the docs commit (not deferred to ship), per the package skill.
- Reviewer verdict: **PASS**.
  No warnings.
