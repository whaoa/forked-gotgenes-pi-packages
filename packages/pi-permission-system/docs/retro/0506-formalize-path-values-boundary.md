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

## Stage: Implementation — Build (2026-06-30T14:00:00Z)

### Session summary

Executed all three plan steps as docs/config changes: wrote ADR `decisions/0002` (formalize decision + rejected collapse alternative), tightened the JSDoc on `access-intent.ts` / `permission-resolver.ts` / `permission-manager.ts`, added the `no-restricted-imports` ESLint guard on `permission-manager.ts`, and marked Phase 7 Step 5 complete in `architecture.md` (heading, S5 Mermaid node, metric row, residual bullet) plus a `SKILL.md` pointer.
Four commits total (three plan steps + one reviewer-WARN fixup); non-breaking, runtime untouched, 2194 tests green.

### Observations

- Verified the ESLint guard actually fires before trusting it: temporarily added an `AccessPath` import to `permission-manager.ts`, confirmed `eslint` flagged `no-restricted-imports`, then reverted — avoids a false-green guard, which was the whole point of the durability mechanism.
- The scratch tour file was never committed in planning, so "delete" was just an `rm` of an untracked file (no `git rm`).
- Pre-completion reviewer returned **WARN** (no blocking failures), two findings, both addressed in commit `cef7cccf`:
  - WARN 1: the two metric rows for Steps 1–3 achievements (`Lexical-only path normalizers`, `Symlink-resistant path surfaces`) had never been marked ✅ by the issues that shipped those steps; with Phase 7 now closed there is no later issue to add them, so I added the ✅ marks now.
  - WARN 2: both `SKILL.md` and `architecture.md` already define `[ADR-0002]` as a reference link to **pi-subagents'** ADR (cross-package context), so this package's plain-text "ADR-0002" collided nominally; disambiguated by referencing the local ADR by its path (`docs/decisions/0002-path-values-string-boundary.md`) instead of the bare token.
- Lesson for future package ADRs: the `NNNN` numbering is per-package, but reference-link tokens like `[ADR-0002]` are file-scoped and already taken by cross-package citations — refer to a local ADR by path, not a bare `ADR-NNNN` token, in any doc that also cites another package's ADR.
- Phase 7 is now fully closed (Steps 1–5 all ✅); the heading carries `(complete)` matching Phase 6's convention.
  Did not archive the Phase 7 detail to a `history/` file (Phase 6 was condensed when complete) — that was out of this plan's scope; flag as a possible follow-up tidy if the roadmap section grows unwieldy.
