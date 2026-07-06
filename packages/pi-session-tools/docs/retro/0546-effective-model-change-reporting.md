---
issue: 546
issue_title: "pi-session-tools: report models by messages handled, not raw model-change markers"
---

# Retro: #546 — pi-session-tools: report models by messages handled, not raw model-change markers

## Stage: Planning (2026-07-05T00:00:00Z)

### Session summary

Planned the fix for phantom `model_change` markers in `read_session` / `read_parent_session` reporting.
The plan lives at `packages/pi-session-tools/docs/plans/0546-effective-model-change-reporting.md`: a shared pure helper `collectEffectiveModelChangeIndices` drives both `formatTranscript` (suppress phantom `[model change]` lines) and `summarizeEntries` (count only effective switches), plus README and `.pi/prompts/retro.md` doc updates.

### Observations

- The issue proposed two improvements; scope was deliberately narrowed to **improvement 2 only** (phantom suppression) after tracing the actual consumer.
  The retro model-performance lens is the sole reader, and it attributes turns via the inline `[provider/model]` labels already in the transcript — no per-model aggregate is consumed.
  The operator confirmed dropping the `summarizeModels` roll-up (AC1's "per-model turn counts"), treating the issue's "Proposed direction" as a hypothesis, not a spec.
- Two `ask_user` rounds: the first was redirected ("let's talk about what information is useful first"), which surfaced that the roll-up was a solution without a question behind it.
  Reading `.pi/prompts/retro.md` to find what the reporting actually feeds was the decisive step.
- Key design decision: a **zero-assistant guard** in `collectEffectiveModelChangeIndices` — a `types: ["model_change"]` filtered stream has no ground truth, so it falls back to rendering/counting all markers.
  This preserves the existing `read-parent-session.test.ts` filter test and keeps transcript and summary consistent in that edge case.
- Collapsed-row `modelChanges` count changes from raw markers to effective switches (operator choice); `SessionSummary` shape is unchanged, so it stays a non-breaking `fix:`.
- Verified no `docs/architecture/` roadmap and no `package-pi-session-tools` skill exist for this package, so the symbol-grep sweep was limited to `src/`, `test/`, README, and the retro prompt.
- The `read-session.test.ts` details fixture has a trailing `model_change` that becomes a phantom under the new rule — flagged for update in TDD step 2 so its `modelChanges` assertion stays meaningful.

## Stage: Implementation — TDD (2026-07-05T00:00:00Z)

### Session summary

Implemented the plan's two `fix:` TDD cycles plus two `docs:` commits: `collectEffectiveModelChangeIndices` (new shared pure helper in `format-transcript.ts`) drives phantom-line suppression in `formatTranscript` and the effective count in `summarizeEntries`; updated the README transcript example and replaced the `.pi/prompts/retro.md` model-performance-lens caveat.
Test count in `pi-session-tools` grew from 75 to 87 (12 new tests: 6 direct `collectEffectiveModelChangeIndices` cases, 3 `formatTranscript` suppression cases, 4 `summarizeEntries` effective-count cases minus 1 renamed rather than added — net +12).
All four commits landed as separate, focused changes; no deviations from the plan's TDD Order.

### Observations

- **Lint trap: TS narrowing across a `.forEach` closure.**
  The first implementation of `collectEffectiveModelChangeIndices` used `entries.forEach((entry, index) => { ... })` with `pendingIndex`/`sawAssistantMessage` mutated inside the callback.
  `@typescript-eslint/no-unnecessary-condition` flagged `if (!sawAssistantMessage)` as "always truthy" — TypeScript's control-flow narrowing does not track mutations made inside a nested closure the way it does within a single function body.
  Fix: rewrote as a plain `for (const [index, entry] of entries.entries())` loop (matching the file's existing style elsewhere), which resolved the lint error immediately with no logic change.
  This is a reusable pattern worth remembering: prefer a `for` loop over `.forEach()` when a callback mutates outer-scope `let` variables that later conditionals depend on.
- **`Edit` tool atomic-batch rejection (documented AGENTS.md behavior, confirmed in practice).**
  The first `format-transcript.test.ts` edit batch (2 edits: import + one appended test) failed entirely because the plan's literal `\u2192` escape sequence did not match the file's actual `→` character (pi-autoformat had already normalized it).
  Per AGENTS.md guidance, re-applied both edits with the literal arrow character in one call; succeeded.
- **Read-session fixture edge case turned out benign.**
  Extending the `read-session.test.ts` details fixture with a post-switch assistant turn (per plan step 2) produced a test that passed under *both* the old and new `modelChanges` semantics (raw count and effective count both happened to be 1) — so it wasn't a true red/green cycle for that file, only for `entry-summary.test.ts`.
  This matched the plan's expectation ("remains a meaningful assertion") rather than being a gap.
- **Pre-completion reviewer: PASS.**
  All deterministic checks (`pnpm run check`, `pnpm run lint`, `pnpm run test`, `pnpm fallow dead-code`) passed; all 3 acceptance criteria assessed, with AC1 ("per-model turn counts") explicitly noted as an intentional, plan-documented descope rather than an oversight.
  Reviewer flagged one action item for the ship step: surface the AC1 descope explicitly in the issue-close comment so it reads as a scoped delivery, not a silent partial fix.

## Stage: Final Retrospective (2026-07-06T00:00:00Z)

### Session summary

Reviewed the full arc of issue #546 (Planning → TDD → Ship) for workflow improvements.
Two consensus-driven changes were approved and implemented: a new `code-design` skill entry documenting a `.forEach()` closure-narrowing lint trap, and an extension to `/plan-issue`'s "Decide" gate requiring a proposed aggregate/report to be traced to a real consumer before its shape is designed.

### Observations

#### What went well

- Tracing the issue's proposed `summarizeModels` roll-up back to its one real consumer (`.pi/prompts/retro.md`'s model-performance lens) via `grep`/`Read`, rather than accepting the issue's literal proposal at face value, surfaced that the lens already had per-turn attribution and only needed the phantom-marker noise removed.
  This collapsed a two-part proposal into a single, smaller, better-targeted fix before any code was written.
- Checks ran incrementally throughout the TDD cycle (`pnpm run check`/`lint`/`test` after each step, plus root-level `lint` and `pnpm fallow dead-code` before the final commit) — no gap between a change landing and its verification.

#### What caused friction (agent side)

- `premature-convergence` — the first `ask_user` call during Planning built three questions entirely around *how* to shape/place the issue's proposed `summarizeModels` roll-up, without first checking whether any real consumer read that shape.
  Impact: one wasted `ask_user` round-trip; no commit rework (caught before any plan artifact was written), but cost a full question-answer-reanalyze cycle.
  The user's redirect ("let's talk about what information is useful first... look to the questions we ask at retro and retro-stage") is what corrected course.
- `instruction-violation`, self-identified — the first `Edit` call on `format-transcript.test.ts` used the plan document's literal `\u2192` escape sequence instead of the file's actual `→` character, violating the system-level Unicode-character instruction.
  The 2-edit atomic batch was rejected; corrected on the immediate retry.
  Added friction but no rework.
- Novel, reusable finding (not a violation) — mutating `pendingIndex`/`sawAssistantMessage` inside an `.forEach()` callback caused `@typescript-eslint/no-unnecessary-condition` to flag a later `if (!sawAssistantMessage)` as "always truthy", since TypeScript's control-flow narrowing doesn't track closure-scoped mutations back into the enclosing scope.
  Rewriting as a `for...of` loop fixed it instantly — now documented in `code-design` (see Changes made).

#### What caused friction (user side)

- None — the one intervention (the Planning-stage redirect) was a well-timed, low-cost correction made before any artifact existed, not a correction of already-committed work.

### Changes made

1. Added a "Closure narrowing loop" entry to the "Biome / ESLint linter conflicts" section of `.pi/skills/code-design/SKILL.md`, documenting the `.forEach()`/`no-unnecessary-condition` trap and the `for...of` fix.
2. Extended the "Decide" section of `.pi/prompts/plan-issue.md` with a rule requiring a proposed aggregate/report to be traced to a concrete downstream consumer before its shape is designed (Refs #546).
