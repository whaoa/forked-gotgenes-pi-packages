---
issue: 549
issue_title: "pi-session-tools: read an arbitrary session file by path"
---

# Retro: #549 — pi-session-tools: read an arbitrary session file by path

## Stage: Planning (2026-07-06T00:00:00Z)

### Session summary

Planned two new `pi-session-tools` tools that close the sibling-session gap surfaced by #546: `read_session_file` (render an arbitrary session file by path through the existing `formatTranscript` + `summarizeEntries` pipeline) and `list_session_files` (encode a required `cwd` to its `--<dashed-cwd>--` session directory and list its `.jsonl` files newest-first).
The plan lives at `packages/pi-session-tools/docs/plans/0549-read-arbitrary-session-file.md`: a new `src/session-file.ts` module (the generic reader moved + renamed from `parent-session.ts`, plus `encodeCwdToSessionDirName` / `deriveSessionsRoot` / `listSessionFiles`), a shared `buildTranscriptResult` extraction, the two tools, README, and adoption in `.pi/prompts/retro.md` + `ship-worktree.md`.

### Observations

- Two `ask_user` rounds settled the three design choices the issue itself raised.
  The operator chose: a **separate** `read_session_file` tool (not a `read_session` `path` param); **accept any readable path** (no `~/.pi/agent/sessions/` allowlist — the agent already has `Read`/`Bash` on any file, so an allowlist is friction without a security boundary); and **include the discovery helper now** as its own tool.
  A follow-up `ask_user` pinned the discovery tool's contract: directory + newest-first file listing, with a **required** `cwd` argument (no `process.cwd()` default, since the sibling use case always targets a different directory).
- `readParentSessionEntries` in `parent-session.ts` is already a generic JSONL reader despite its name — the plan renames it to `readSessionFileEntries` and moves it to the new `session-file.ts`, leaving `parent-session.ts` owning only the parent-`tasks/` derivation.
  It has exactly one call site (`index.ts`) and no direct test (covered transitively via a `node:fs` mock in `read-parent-session.test.ts`), so the rename/move is low-risk and folds into one step.
- Chose to **derive the sessions root** from the current session file (via the current cwd's encoded segment) with a `homedir()` fallback, rather than hard-coding `~/.pi/agent/sessions/` as the interim `/ship-worktree` `sed` one-liner does — this tracks a relocated config dir and is unit-testable on both branches.
- Extracted `buildTranscriptResult` to avoid a third copy of the filter/limit/summarize/format block; verified all three tools share identical lifecycle semantics (no differing guards) before consolidating, and made step 1 a behavior-preserving `refactor:` guarded by the existing tool suites.
- Listed the #251 / #411 / #546 invariants the refactor touches, each pinned by an existing green test; the plan is `refactor:` + `feat:` + `docs:`, ships independently (no batch, no architecture roadmap for this package).
- No follow-up issues filed — the plan names no deferred work; prompt adoption (the one real consumer, Refs #546) is folded in as the final `docs:` step.

## Stage: Implementation — TDD (2026-07-06T15:44:00Z)

### Session summary

Executed all 6 TDD Order steps as planned: extracted `buildTranscriptResult` (behavior-preserving refactor, 87/87 existing tests green), added `src/session-file.ts` (`readSessionFileEntries` moved/renamed from `parent-session.ts`, plus `encodeCwdToSessionDirName` / `deriveSessionsRoot` / `listSessionFiles`), registered `read_session_file` and `list_session_files`, documented both in the README, and adopted `read_session_file`/`list_session_files` in `.pi/prompts/retro.md` + `ship-worktree.md` in place of the raw `Read`/`Bash` guidance.
Test count grew from 87 to 110 (+23 across three new test files).
No deviations from the plan — every Module-Level Changes file was touched exactly as listed.

### Observations

- The refactor step (`buildTranscriptResult` extraction) had no new test by design — the existing `read-session.test.ts` / `read-parent-session.test.ts` suites served as the regression net, and both stayed green with zero diff through the whole implementation (verified explicitly in pre-completion review).
- `deriveSessionsRoot` tests needed the real `os.homedir()` rather than a hardcoded path, since the CI/dev environment's actual home directory varies — computed the expected path via `join(homedir(), ".pi", "agent", "sessions")` in the test body instead of a literal string, avoiding an environment-coupled assertion.
- `listSessionFiles` sorts by `statSync(...).mtimeMs` (not the filename timestamp) per the plan's design, tie-broken by filename — pinned by a test with distinct mocked mtimes in non-filename order.
- Two `Edit` calls with a stray extra JSON key (`"newText_placeholder"` / an empty-string key) were rejected by the tool's schema validation before any file write; recovered immediately by re-issuing clean multi-edit calls with no functional cost.
- Pre-completion reviewer: **PASS**.
  All deterministic checks (`check`, `lint`, `test`, `fallow dead-code`) passed; all 4 plan Goals verified against code; the #251/#411/#546 invariants confirmed intact via byte-identical diffs on the five sibling test files reached through the refactor.
  No WARN findings.
