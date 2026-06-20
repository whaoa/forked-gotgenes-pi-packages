---
issue: 444
issue_title: "pi-subagents: shrink the agent widget to background runs only"
---

# Retro: #444 — pi-subagents: shrink the agent widget to background runs only

## Stage: Planning (2026-06-20T18:47:05Z)

### Session summary

Produced a numbered implementation plan for Phase 19 Step 3: shrink `AgentWidget` to background agents only by funneling both `manager.listAgents()` call sites (`update()` and `renderWidget()`) through a single private `listBackgroundAgents()` accessor that applies `record.invocation?.runInBackground === true` once at the source.
Confirmed the change is single-package (`pi-subagents`), non-breaking, and `Release: independent` per the architecture roadmap.

### Observations

- Issue author is the operator (`gotgenes`) and the proposed change is unambiguous, so the `ask-user` gate was skipped.
  The design is a legitimate improvement (removes the two-site duplication and fixes the latent inconsistency), not procedure-splitting.
- `widget-renderer.ts` needs **no** code change — it has no foreground-specific path; filtering at the data source in `agent-widget.ts` is sufficient.
  Listed in Module-Level Changes only to record the verification.
- Key risk is mass test breakage: the existing `update()`-driven fixtures (two `makeWidget` helpers + the projection test's `createTestSubagent`) would all be filtered out once the predicate lands.
  Mitigated with a tidy-first TDD step 1 that adds `invocation: { runInBackground: true }` to fixtures while the filter does not yet exist (inert), so step 2 only adds new tests.
- `assembleWidgetState` pure-function tests are unaffected — they call the function directly with `AgentSummary[]`, bypassing the accessor.
- Verified `clearWidget`'s stale-purge has no regression: foreground agents are never seeded into `finishedTurnAge`, so purging against the background-only list is correct.
- Doc grep surfaced one stale prose line (`README.md:64` "showing all active agents"); SKILL.md and `comparison-with-upstream.md` references remain accurate.
- Deferred (Open Question): relabeling the widget heading `Agents` → `Background agents` — out of scope for this issue.
