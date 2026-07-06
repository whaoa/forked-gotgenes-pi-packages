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
