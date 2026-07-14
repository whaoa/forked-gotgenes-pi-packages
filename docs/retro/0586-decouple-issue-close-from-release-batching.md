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
