---
issue: 575
issue_title: "pi-permission-system: survey other exec-capable CLI rewrites for indirection-wrapper flooring"
---

# Retro: #575 — survey exec-capable CLI rewrites for indirection-wrapper flooring

## Stage: Planning (2026-07-14T21:26:44Z)

### Session summary

Planned Phase 11 Step 6: survey modern exec-capable CLI rewrites and extend `INDIRECTION_WRAPPER_NAMES` (`src/access-intent/bash/command-enumeration.ts`) so an inner command cannot ride a permissive `allow` on the wrapper text, following [#490].
Researched every candidate's exec behavior, then confirmed the adoption inventory with the operator via `ask_user`.
Plan filed at `docs/plans/0575-survey-exec-capable-wrappers.md`; two TDD cycles (one `fix:`, one `docs:`).

### Observations

- Web research classified each candidate by the criterion "does it run an inner command per input or as a subcommand?":
  adopt `parallel`/`rust-parallel`/`rush` (parallelizers), `doas` (sudo rewrite), `setsid`/`stdbuf`/`watch`/`flock` (prefix wrappers); reject `sad` (batch file editor), `fselect` (SQL file search), `runiq` (line dedupe) as non-exec.
- `ask_user` confirmed the operator adopts all 8 always-invoke wrappers and **declines** `gargs` (exec-capable but niche); rejection notes stay plan-only (no issue comment).
- None of the adopted tools is flag-gated like `find`/`fd` — each always invokes its command — so all go into `INDIRECTION_WRAPPER_NAMES`, none into `EXEC_CONDITIONAL_WRAPPERS`.
- Per the [#490] retro, the floor half needs no code beyond the set edit: `WRAPPER_SENTINEL` already carries the `indirection` key and the advisory path reuses `resolveBashCommandCheck`, so the entire change is 8 strings + classifier tests + docs.
- Behavior-tightening `fix:` (not breaking), matching the [#490] precedent — the floor only clamps `allow` → `ask`, never overrides `deny`.
- Doc surfaces that hard-enumerate the inventory and must be updated: `docs/configuration.md` (line ~329) and the package skill's Debugging list.
  Surfaces using a `…` ellipsis (`README.md`, `bash-command.ts`, `program.ts`, `architecture.md` lines 756/761) stay accurate without edits.
- Release: **ship independently** (Step 6 is `Release: independent`; not a member of the "shell-tool-aliases" batch).

## Stage: Implementation — TDD (2026-07-14T21:35:00Z)

### Session summary

Implemented the single planned TDD cycle plus the docs commit: added 8 always-invoke wrappers (`parallel`/`rust-parallel`/`rush`/`doas`/`setsid`/`stdbuf`/`watch`/`flock`) to `INDIRECTION_WRAPPER_NAMES` in `command-enumeration.ts`, pinned by 8 new `program.test.ts` classifier rows, then synced the `configuration.md` and package-skill enumerations and marked Phase 11 Step 6 `✅`.
Test count went 2464 → 2472 (+8); `check`, root `lint`, and `fallow dead-code` all green; no lockfile changes.
Pre-completion reviewer returned **PASS**.

### Observations

- The change fell out exactly as planned — as the [#490] retro predicted, the floor half needed zero code beyond the `Set` edit (the `WRAPPER_SENTINEL` `indirection` key and advisory reuse were already in place), so the whole production change was 8 strings.
- Tidy-First assessor recommended nothing: both target files were already shaped for a straight append (the `Set` literal carries an "extend this set" doc comment; the `it.each` table has an established tuple form).
- No deviations from the plan.
  All five Module-Level Changes files were touched; the plan's "deliberately not edited" ellipsis surfaces (`README.md`, `bash-command.ts`, `program.ts`, `architecture.md` 756/761) were confirmed still accurate and left alone.
- `rust-parallel`'s hyphen matches the set entry verbatim (`basename` splits only on `/`), confirmed green by its classifier row.
- Pre-completion reviewer: **PASS**, no warnings.

[#490]: https://github.com/gotgenes/pi-packages/issues/490
