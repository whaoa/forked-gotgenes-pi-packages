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
