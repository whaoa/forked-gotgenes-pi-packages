---
description: Peer-session ship prep — rebase a worktree branch onto main, hand off to root for landing
---

# Ship a worktree branch (peer session)

Argument: `$1` is the issue number implemented in this worktree.

This is the **peer-session** half of the parallel-worktree ship flow.
It prepares the branch for landing but does **not** touch `main`, close the issue, or release — the **root session** does that via `/land-worktree $1`.
For trunk work (committing directly on `main`), use `/ship-issue` instead.

Fetch the issue title via `gh issue view $1 --json title -q .title`, then call `set_session_name` with name `#$1 Ship (worktree) — <issue title>`.

## 1. Confirm this is a worktree branch

1. Run `git branch --show-current`.
2. If the branch is `main` (or not an `issue-$1-*` branch), stop and report — this is the trunk flow's job; use `/ship-issue` from the root instead.
3. Only proceed on an `issue-$1-<slug>` branch.

## 2. Pre-push checks

Run from the worktree root (your current directory):

1. `pnpm run lint` — catches cross-package lint violations CI runs at root level.
2. `pnpm fallow dead-code` — CI runs this gate on every `main` push, so a failure here blocks the eventual land.

If either fails, fix and commit before continuing.

## 3. Write ship stage notes (must land with the branch)

Write a concise **ship** stage breadcrumb — not the final retrospective.
The deliberate, interactive final `/retro $1` runs once at the root after `/land-worktree $1`, on `main`; do **not** run it here.
The stage note lives in an `exclude-paths` dir, so it triggers no release — but it must be committed **on this branch** so it rides the single ff-merge when root lands the work.

1. Determine the retro file path (same `NNNN-<slug>` as the plan file: single-package → `packages/<PKG>/docs/retro/`; cross-package → `docs/retro/`).
2. Append a stage entry (anchor the `Edit` on the file's last line — the repeated `### Observations` headers make header-anchored edits ambiguous):

   ```markdown
   ## Stage: Ship (worktree) (<ISO 8601 timestamp>)

   ### Session summary

   1–2 sentences: pre-push check results and any context the root needs at land time (deferred work, the plan's `**Release:**` marker, follow-ups).

   ### Observations

   Keep it a concise breadcrumb, not a full retrospective — the final `/retro $1` at the root captures the retrospective proper.
   ```

3. Commit: `git add <retro-file> && git commit -m "docs(retro): add ship stage notes for issue #$1"`.

## 4. Sync and rebase onto main

1. `git fetch origin`.
2. `git rebase origin/main`.
3. On a conflict: run `git rebase --abort`, then stop and report the conflicting files.
   Do not auto-resolve — the operator decides.
4. After a clean rebase, the branch is a linear descendant of `origin/main`, ready for a fast-forward merge.

Do **not** push this branch and do **not** force-push anything — the root session shares this repo's `.git` and merges the local branch ref directly.

## 5. Hand off to the root session

Report:

- The branch name and its new HEAD (`git log --oneline -1`).
- That checks passed, the ship stage note is committed, and the rebase onto `origin/main` is clean.
- That the final `/retro $1` is **not** run here — it runs at the root after `/land-worktree $1`.
- The next action: **switch to the root session and run `/land-worktree $1`**.

## Constraints

- Never touch `main` from a worktree (no checkout, no merge, no push to `main`).
- Never force-push.
- If the rebase conflicts, stop — do not resolve automatically.
- Do not close the issue or merge a release PR here; that is `/land-worktree`'s job.
