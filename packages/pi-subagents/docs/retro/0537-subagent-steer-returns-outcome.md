---
issue: 537
issue_title: "pi-subagents Phase 20 Step 3: Subagent.steer returns an outcome"
---

# Retro: #537 — Subagent.steer returns an outcome

## Stage: Planning (2026-07-04T00:00:00Z)

### Session summary

Planned Phase 20 Step 3: move the non-running rejection rule inside `Subagent.steer` and have it return a discriminated `SteerOutcome` (`delivered` / `buffered` / `rejected`), so `SteerTool.execute` and `SubagentsServiceAdapter.steer` drop their `status !== "running"` pre-checks and switch on the outcome.
The plan is a single Tell-Don't-Ask refactor commit (class + both consumers + all three affected test files land together because the return-type change breaks them atomically), plus an excluded-path architecture-doc update.

### Observations

- Release marker is `ship independently` per the roadmap; it is refactor-only, so it cuts no release on its own and auto-batches — the plan's rationale says so explicitly (Refs #479).
- Confirmed exact behavior parity for the boolean mapping: unknown/`rejected` → `false`, `buffered`/`delivered` → `true`; and the `subagents:steered` event fires for buffered + delivered but not rejected (the pre-check returned before the emit today).
- The `service-adapter` "non-running" test currently mocks a bare `{ id, status } as Subagent` stub; since the adapter will call `record.steer` unconditionally, that fixture must switch to a real `createTestSubagent({ status: "completed" })` that owns the real `steer`.
- `SteerOutcome` will be exported from `subagent.ts` and re-exported via `types.ts` (both consumers already import `Subagent` from that barrel), keeping the re-export non-speculative.
- Planned extracting the delivered-path stats rendering into a private `renderDelivered` helper so `steer-tool.execute` clears the cyclomatic-< 10 target.
- Only `docs/architecture/architecture.md` needs a prose/diagram edit (the class-diagram `steer` signature); it is an excluded path, so no release impact.
  Historical plan/retro docs are frozen and left untouched.
