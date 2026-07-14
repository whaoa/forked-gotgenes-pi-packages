---
issue: 536
issue_title: "pi-subagents Phase 20 Step 2: decompose get-result-tool.execute"
---

# Retro: #536 — pi-subagents Phase 20 Step 2: decompose get-result-tool.execute

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Planned the decomposition of `GetResultTool.execute` (61 lines, 15 cyclomatic, CRAP 63.6) into a thin wait/consume shell plus a pure report formatter in a new `src/tools/get-result-report.ts`, mirroring the existing `result-renderer.ts` pure-formatter pattern.
The formatter takes a narrow `AgentReport` value object (12 fields, all read) and exposes `renderStatsParts` / `renderReportBody` / `formatAgentReport`; the shell gathers the report via a private `buildReport` and delegates.
Produced a two-step plan (atomic extract-and-rewire refactor → docs/skill sync) filed at `docs/plans/0536-decompose-get-result-tool.md`.

### Observations

- Confirmed Step 1 ([#535]) has landed — the current `get-result-tool.ts` already calls `this.notifications.consume(id)` (no `record.notification?.` reach-through), so this step builds cleanly on the delivered Step 1 interface.
- Release is the batch tail: `Release: batch "result-delivery"` with Step 2 as the tail, so `**Release:** ship now — batch tail` — the batched release-please PR (Step 1 + Step 2) merges at ship time.
- The extraction is a genuine design improvement (not procedure-splitting): the formatter returns a value, owns the stats/body assembly as a testable unit, and is fed a narrow ISP value object rather than the full `Subagent` — the whole point is collapsing the CRAP score by making the assembly directly unit-testable.
- Key mechanical constraint flagged for TDD: the new formatter export **must** be wired into `execute` in the same commit it is added, or `pnpm fallow dead-code` (a CI gate) trips on the unused export — so extract-and-rewire is one atomic step, not two.
- Behavior-preservation is the dominant risk: the formatter body is a line-for-line transcription of today's inline assembly (separators, `Math.round`, `?? "No output."`, conversation header), pinned by new character-level formatter tests plus the retained `get-result-tool.test.ts` body/verbose assertions.
- Preserved invariants carried from Step 1: the pre-await "Bug 1" consume ordering and the single `consume(id)` tell (no record reach-through); the shell keeps both consume sites verbatim.
  Moving the terminal consume ahead of `buildReport` is behavior-neutral (consume mutates `notifications`; report building only reads the record).
- No `ask_user` gate: the issue is the operator's own, refactor-only, and the decomposition is roadmap-specified with no design ambiguity.

[#535]: https://github.com/gotgenes/pi-packages/issues/535
