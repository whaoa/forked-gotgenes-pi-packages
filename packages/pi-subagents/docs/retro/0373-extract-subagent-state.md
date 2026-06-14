---
issue: 373
issue_title: "Extract SubagentState; make Subagent execution deps mandatory"
---

# Retro: #373 — Extract SubagentState; make Subagent execution deps mandatory

## Stage: Planning (2026-06-14T03:34:51Z)

### Session summary

Produced the implementation plan at `packages/pi-subagents/docs/plans/0373-extract-subagent-state.md`.
The architecture doc (Phase 17 Step 2 + "First-principles refinement") already specified the design precisely and the issue body matched it, so planning was confirmation-and-detailing rather than discovery.
Issue is first-party (`gotgenes`) and unambiguous — skipped the `ask_user` gate.

### Observations

- **Not breaking** for the published surface: `src/service/service.ts` exposes `SubagentRecord`/`SubagentStatus`/spawn-config, never `SubagentInit` or the `Subagent` constructor.
  Only the internal constructor signature changes.
- **Single production construction site** confirmed: `SubagentManager.spawn` (~line 139) is the only `new Subagent(...)` outside tests — this is what makes mandatory execution deps viable.
- **Observer retarget is required**, not optional: making execution mandatory would otherwise force `record-observer.test.ts` to stub execution.
  Pointing `subscribeSubagentObserver` at `SubagentState` (and dropping the record from `onCompact`, closing over `this` in `subagent.ts`) is the move that lets observer tests target `SubagentState` directly.
- **`resume()`'s missing-session throw stays** — it guards a genuine runtime state, not a construction concern.
  Only the two `run()` "not configured for execution" throws are deleted.
- **`SubagentStatus` home**: moved to `subagent-state.ts` but re-exported from `subagent.ts` to keep `service.ts`'s import path (and the public type bundle path) unchanged, and to avoid a circular import.
- **Lift-and-shift for the large test file**: `test/lifecycle/subagent.test.ts` (~700 LOC).
  Step 1 funnels constructions through a local helper and moves the state-machine `describe` blocks to the new `subagent-state.test.ts`, so Step 3's mandatory-execution flip is bounded to the helper + two run/resume factories.
  Step 3 is unavoidably one atomic commit (removing optional fields breaks every construction at the type level at once).
- **Doc updates identified**: `architecture.md` (lifecycle file listing, `Subagent` class diagram, mark Step 2 ✅ Complete, Phase 17 prose ~line 879, type-complexity table ~line 649) and `SKILL.md` (Lifecycle 10→11 modules, total 56→57 files).
- Deferred per scope boundary: metrics-as-projection and result-delivery domain extraction (the other two of the four conflated domains).
