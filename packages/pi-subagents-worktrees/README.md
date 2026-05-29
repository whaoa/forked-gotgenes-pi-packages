# @gotgenes/pi-subagents-worktrees

Git worktree isolation for [`@gotgenes/pi-subagents`](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-subagents).

This extension registers a `WorkspaceProvider` with the subagents core: opted-in agents run in a temporary git worktree (an isolated copy of the repo), and any changes they make are saved to a branch when they finish.
Worktrees are one *workspace strategy*, not core behavior — so the git plumbing lives here, outside the minimal subagents core (see ADR 0002 in the pi-subagents package).

## Install

Install **after** `@gotgenes/pi-subagents`.
Pi loads packages in the order they are listed in `.pi/settings.json`, and this extension registers its provider with the subagents service at load time — so the subagents core must load first.

```json
{
  "packages": [
    "npm:@gotgenes/pi-subagents",
    "npm:@gotgenes/pi-subagents-worktrees"
  ]
}
```

If `@gotgenes/pi-subagents` is not loaded first (or not installed at all), this extension does nothing.

## Configuration

Worktree isolation is **opt-in per agent type**.
List the agent types that should run in a worktree in a `subagents-worktrees.json` file:

- Global: `~/.pi/agent/subagents-worktrees.json`
- Project: `<cwd>/.pi/subagents-worktrees.json` (overrides global)

```json
{
  "worktreeAgents": ["general-purpose", "refactorer"]
}
```

An agent type not in `worktreeAgents` runs in the parent working directory, exactly as if this extension were not installed.

## Behavior

- A child whose agent type is listed gets a fresh detached worktree at `HEAD` before it runs.
- When the child finishes with no changes, the worktree is removed.
- When the child finishes with changes, they are committed to a branch (`pi-agent-<id>`), and the child's result gains a note: `Changes saved to branch \`<branch>\`. Merge with: \`git merge <branch>\``.
- If worktree creation fails for an opted-in agent (not a git repo, no commits yet, or `git worktree add` fails), the child run **fails** with an explanatory error rather than silently running unisolated.

## Migrating from `isolation: "worktree"`

Earlier versions of `@gotgenes/pi-subagents` accepted an `isolation: "worktree"` spawn flag.
That flag was removed from the core; install this package and list the agent types you want isolated in `worktreeAgents` instead.
