---
issue: 586
issue_title: "Mid-batch issues orphan: /ship-issue defers close, batch-tail ship never closes them"
---

# Retro: #586 — Mid-batch issues orphan: /ship-issue defers close, batch-tail ship never closes them

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Planned the fix for orphaned mid-batch issues: `/ship-issue` couples the issue close to the release-batch decision (step 4b stops early on defer, skipping steps 5–6), so a mid-batch member is released but never closed.
Chose Fix 1 (decouple close from release) over Fix 2 (batch-tail closes siblings) after the operator confirmed via `ask_user`.
The plan is a single-file docs change to `.pi/prompts/ship-issue.md`; next step is `/build-plan` (no test cycles).

### Observations

- Key discovery: `.pi/prompts/land-worktree.md` **already** implements Fix 1 — its step 5 always closes the issue and its step 6 ("Release (decoupled and serialized)") separately handles the defer.
  Fix 1 brings the trunk `/ship-issue` into parity with the already-correct worktree flow.
- The issue's stated downside of Fix 1 ("close comment can no longer cite a released version") does not actually apply: both flows' close comments already cite `"Implemented in <sha>"`, never a version.
- The `pkg:pi-permission-system` label reflects only where the concrete instance (#580) occurred; the change is a repo-root prompt edit, so the plan lives in `docs/plans/`, not a package directory.
- Grep confirmed the coupling lives in exactly one line (`ship-issue.md:70`); `AGENTS.md` release-batching prose describes only the release decision and stays accurate, so no `AGENTS.md` edit is planned.
- Ships independently — a `docs:` change under `.pi/prompts/` is attributed to no package and cuts no release on its own.
- No follow-up issues identified; no open questions.

## Stage: Implementation — Build (2026-07-13T00:00:00Z)

### Session summary

Executed the plan's single step: edited `.pi/prompts/ship-issue.md` steps 4b, 5, and 6 to decouple the issue close from the release-batch decision, matching `/land-worktree`'s already-correct contract.
Step 4b now always continues to step 5 (close) regardless of the release decision, and skips only step 6 (release) on defer; step 5's close-comment bullet list and stacked-issue-scan note were updated accordingly; step 6 gained an explicit skip-on-defer lead sentence.
Single `docs:` commit, no deviations from the plan.

### Observations

- No code, tests, or `AGENTS.md` changes were needed — the plan's grep in the Planning stage correctly scoped this to one file.
- `pnpm run lint` and `pnpm exec rumdl check .pi/prompts/ship-issue.md` were clean on first pass; no auto-fix needed.
- Pre-completion reviewer verdict: **PASS**.
  Verified all four planned edits landed verbatim, confirmed no other doc references the old coupled behavior (reverse check), and confirmed both named "Invariants at risk" (the step-4 CI-failure gate and the unchanged "Release coordination" defer ask) hold by inspection.
- All steps completed; nothing remains for this issue before `/ship-issue`.
