---
issue: 534
issue_title: "Revise /plan-improvements and improvement-discovery: cause-first discovery, deferral gate, and audit gaps"
---

# Retro: #534 — Revise /plan-improvements and improvement-discovery: cause-first discovery, deferral gate, and audit gaps

## Stage: Planning (2026-07-04T14:45:44Z)

### Session summary

Planned the revision of two repo-root workflow files — `.pi/prompts/plan-improvements.md` and `.pi/skills/improvement-discovery/SKILL.md` — to fix a fallow-anchoring bias and several audit gaps surfaced by the pi-subagents Phase 20 retro.
The plan resequences discovery to cause-first (architecture doc + hypothesis before fallow), adds an open-issue sweep, a qualitative deferral gate, a feasibility probe, a conditional directory-organization step, per-step cause attribution and Impact/Risk/Priority scores, and a retro hook.
Filed the plan at `docs/plans/0534-cause-first-improvement-discovery.md` (repo-root, not package-scoped, since no package code changes despite the `pkg:pi-subagents` label).

### Observations

- The `pkg:pi-subagents` label reflects the retro's *origin*, not the change surface — the edited files are repo-root `.pi/` tooling, published in no tarball and part of no architecture roadmap, so the plan is cross-cutting and the release recommendation is "ship independently" (a `docs:` commit that cuts no package release).
- Author is the operator (`gotgenes`), so the issue's detailed checklist is the working spec.
  The one genuine scope decision — the optional retro hook the issue itself flagged — was resolved via `ask_user`: operator chose **include it** (fold into this plan, no separate follow-up issue).
- Design decision on the fallow-anchoring fix: chose **reorder** over demote-in-place, matching the "cause-first" framing and making sequencing self-enforcing.
- Retro-hook design: `/plan-improvements` is phase-scoped, not issue-scoped, so it does not fit the issue-keyed `NNNN-<slug>.md` retro convention.
  Chose a standalone phase-scoped retro at `packages/<PKG>/docs/retro/phase-N-<slug>.md` with inlined frontmatter (`package` / `phase`), following the pattern where `/plan-issue` inlines its own retro frontmatter — this keeps scope to the two files named in the issue and leaves `/finish-phase` (which owns the `history/` archive) untouched.
- No follow-up issues filed — the retro hook was folded in per the operator's answer, and cross-reference checks confirmed the `Release:` mechanism in `AGENTS.md` / `plan-issue.md` is untouched, so no edits propagate outside the two files.
- Next stage is `/build-plan` (docs-only, no TDD cycles).

## Stage: Implementation — Build (2026-07-04T15:05:00Z)

### Session summary

Executed the docs-only build plan across five commits, editing the two repo-root workflow files.
`.pi/prompts/plan-improvements.md` gained the cause-first reorder (architecture doc + cause hypothesis → open-issue sweep → demoted/trimmed fallow), the deferral gate, feasibility probe, conditional directory-org guard, "max 9" ceiling reframe, and a phase-scoped retro hook.
`.pi/skills/improvement-discovery/SKILL.md` gained per-step cause attribution, published Impact/Risk/Priority scores, and the fallow-CRAP gotcha — and its own "Analysis workflow" section was resynced to the cause-first order.

### Observations

- All nine issue-checklist items plus the operator-approved retro hook landed; no package code, tests, or TypeScript touched, so `pnpm run check`/`test`/`fallow` were N/A — verification was `rumdl` lint only.
- Step numbering in `plan-improvements.md` was fully renumbered (1–8) when the open-issue sweep was inserted; the Output section's `(Step 5)` → `(Step 6)` directory-org back-reference was updated to match, and a final grep confirmed no dangling `Step N` references.
- Deviation from the plan's Module-Level Changes: the plan scoped the skill to "Output-format / rule additions, no restructure," but the pre-completion reviewer (WARN) caught that the skill's own top-level "Analysis workflow" numbered list still described the old fallow-first order — directly contradicting this issue's fix.
  Fixed inline as a sixth commit (`1d3efa0b`) rather than deferring, since it is low-risk and central to the issue's goal.
- Pre-completion reviewer: WARN — sole substantive finding (stale skill "Analysis workflow" ordering) resolved inline; the second WARN item (no filed issue for that gap) is moot now that it is fixed.
  No FAIL findings; the `Release:` tag Output contract and Phase N−1 archive hard gate were verified preserved.
