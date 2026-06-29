---
issue: 505
issue_title: "pi-permission-system: dissolve the path-utils grab-bag behind AccessPath (Phase 7 Step 4)"
---

# Retro: #505 — Dissolve the `path-utils` grab-bag behind AccessPath (Phase 7 Step 4)

## Stage: Planning (2026-06-29T00:00:00Z)

### Session summary

Produced a numbered plan to dissolve `src/path-utils.ts` (18 symbols, four jobs, accelerating churn hotspot) into six cohesive modules.
Representation derivation relocates into `src/access-intent/path-normalization.ts` as `AccessPath`'s backing; both containment predicates stay together in a focused `src/path-containment.ts`; safe-system paths, infra-read, tool-input extraction, and the surface/tool lookup sets each get their own module.
The plan is `Release: independent` (a `refactor:`/`docs:` change that auto-batches into the next release).

### Observations

- **The "import cycle" the naïve split implies is not fundamental.**
  The operator pushed back on my "derivation vs containment" framing, observing that you should *prepare the data, then ask questions about it* — geometry should not depend on derivation.
  Tracing it: `isPathWithinDirectory` is already pure geometry over prepared operands, and `isPiInfrastructureRead` already receives an already-canonical `accessPath.boundaryValue()`.
  The lone offender is `isPathOutsideWorkingDirectory`, which canonicalizes both operands inline (the only geometry→representation edge).
  Fixing that mis-factoring — pure geometry over prepared operands, with canonicalization pushed up to its single caller `PathNormalizer.isOutsideWorkingDirectory` — collapses the tangle into a strict DAG **and** lets the issue's literal grouping stand (one representation module, one containment module).
- **Everything in `path-utils.ts` is access-side, not config-side.**
  Config rule patterns are never path-derived (a standing Phase 7 Non-goal), so the real seam is representation-for-matching vs geometry-for-boundaries, sharing the `isPathWithinDirectory` primitive.
- **Step 1 is a real behavior-contract change (TDD red→green); Steps 2–7 are pure relocations** verified by the existing suite staying green after each move + importer update. `path-utils.test.ts` (695 LOC) splits to mirror the new modules; the `isPiInfrastructureRead` block duplicated with `pi-infrastructure-read.test.ts` consolidates.
- **Doc surface to keep in sync** (implementation doc commit, not deferred to ship): `architecture.md` module tree + Phase 7 Step 4 ✅ + Mermaid `S4` node + findings metric + the "PathNormalizer platform seam" prose, and `SKILL.md`'s two `src/path-utils.ts` references. `history/phase-6-*.md` is a frozen snapshot — not edited.
- **Guardrails confirmed:** no `import/no-cycle` lint exists (so the cycle is a design smell, not a CI gate), but the `no-restricted-syntax` `process.platform` guard does — every relocated leaf keeps its injected `platform` parameter. `subagent-context.ts` has its own private within-dir helper and is out of scope.
- Next stage: `/tdd-plan` (Step 1 is true TDD; the rest are refactor-relocation steps).
