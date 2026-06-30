---
issue: 506
issue_title: "pi-permission-system: decide and formalize the path-values boundary (Phase 7 Step 5)"
---

# Retro: #506 — Formalize the `path-values` boundary (Phase 7 Step 5)

## Stage: Planning (2026-06-30T00:00:00Z)

### Session summary

Planned Phase 7 Step 5 — the deliberate decision on the resolver-internal `path-values` `AccessIntent` variant.
The operator requested a code tour before deciding; produced `docs/0506-path-values-boundary-tour.md` (scratch) tracing the gate → resolver → manager flow and reading "what the system wants," then confirmed **formalize** (keep the string boundary) with an **ADR-0002 + tightened inline docs** vehicle via `ask_user`.
The plan is docs + JSDoc + one ESLint `no-restricted-imports` guard; non-breaking, ships independently, and closes Phase 7.

### Observations

- The decision was strongly pre-indicated by the code: the resolver's Tell-Don't-Ask JSDoc, the architecture's "deliberate string boundary" residual note, and Step 2's explicit "the premise Step 5 decides against" all point to formalize.
  The operator still wanted the tour to verify the grain rather than take the lean on faith.
- Chose an ESLint `no-restricted-imports` guard scoped to `permission-manager.ts` over a vitest source-introspection test — it mirrors the existing `process.platform` `no-restricted-syntax` guard (#510), is CI-gated by `pnpm run lint`, and keeps this a `/build-plan` (no red→green cycles).
- The new durable invariant the guard pins: "the manager never imports `AccessPath`."
  Previously convention-only; collapse would now require an explicit, reviewed lint exception.
- Routed to `/build-plan`, not `/tdd-plan`: the only code change is doc comments + one lint rule; the runtime is untouched.
- Rejected `collapse` rationale (recorded for the ADR): SRP (manager stays a string engine), Tell-Don't-Ask wash (unwrap just moves one layer deeper), dependency direction (widening a leaf to save one nominal type + converter).
- Doc-update surface: `architecture.md` (Step 5 completion marks + metric row + residual bullet), `SKILL.md` line 154 (one-clause ADR pointer), three src JSDoc files.
  Historical `docs/plans/05xx` and `docs/retro/05xx` that mention `path-values` are point-in-time records — left untouched.
- The scratch tour file is deliberately uncommitted; the plan's Step 1 deletes it once the ADR supersedes its rationale.
- Release marker: `**Release:** ship independently` — `docs:` commit auto-batches; the Release Recommendation explicitly avoids claiming it cuts a release on its own (Refs #479).
