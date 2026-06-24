---
issue: 468
issue_title: "Evaluate commitlint replacements (convco, cocogitto, committed) for commit-message linting"
---

# Retro: #468 — Evaluate commitlint replacements (convco, cocogitto, committed)

## Stage: Planning (2026-06-24T00:00:00Z)

### Session summary

Produced an evaluate-and-execute plan for replacing the `commitlint` `commit-msg` gate with one of `convco` / `cocogitto` / `committed`.
The plan defines a four-fixture harness (the two acceptance cases plus the two correct breaking forms), a decision matrix, a best-fit-per-tool distribution table, and a new `docs/decisions/` ADR as the durable deliverable.
Confirmed via `ask_user` that the operator wants the swap executed in-cycle if a candidate wins, the comparison recorded as an ADR, and distribution chosen per winning tool.

### Observations

- The `pkg:pi-subagents` label is incongruent — the gate is monorepo-wide root infra, so the plan lives in `docs/plans/` (same call as predecessor [#457], whose `pkg:pi-permission-system` label was also incongruent).
- Release recommendation is **ship independently**: no package source changes, no roadmap batch tag for `#468`.
- Key empirical uncertainty deferred to implementation: whether each tool rejects `feat!(scope):` (the load-bearing `!`-placement guarantee from [#452]/[#457]), and whether `convco check` can lint a single pending message file at all (it is built for commit ranges / `pre-push`, a likely disqualifier for the `commit-msg` use case).
- Distribution landscape: `rumdl` is the precedent (prek remote-repo hook + npm-wrapper devDep used by `pnpm run lint`). `committed` has a first-party prek repo (cleanest fit); `cocogitto`/`convco` would need a `mise` `[tools]` entry (the repo provisions no managed tools today — `mise.toml` is `[env]`-only).
- `fallow` runs `unused-dev-dependencies: error` in CI — a commit-msg-only npm-wrapper devDep has no script call site (unlike `rumdl`), so the plan prefers prek/`mise` provisioning and flags `.fallowrc.json` `ignoreDependencies` as the fallback.
- Doc-grep for the removed `commitlint` symbol found only `README.md:63`, `AGENTS.md:207`, `AGENTS.md:218`; no `package-*/SKILL.md` reference. `docs/decisions` must be added to `release-please-config.json` `exclude-paths` (root-level dir does not exist yet).
- No follow-up issue filed — the swap is in-cycle, and the CI-backstop / commitlint-custom-parser items stay deferred (Open Questions) without speculative issues.

## Stage: Implementation — Build (2026-06-24T00:00:00Z)

### Session summary

Executed all four build steps (Branch A — a candidate won).
Installed `convco`, `cocogitto`, and `committed` via `brew` and ran the four-fixture harness: all three cleared the acceptance bar (case1 `#N`-body pass, case2-before `feat!(scope):` fail, case3-after / case4-noscope pass).
The tie-break selected `committed`; wired it as a `prek` remote-repo `commit-msg` hook (`crate-ci/committed` `v1.1.11`) with a repo-root `committed.toml`, removed `commitlint` config + devDeps, authored the ADR, and updated `AGENTS.md` / `README.md`.

### Observations

- All three candidates support single-pending-message linting — the plan's worry that `convco check` could not was resolved by its `--from-stdin` flag (`cog verify --file -`, `committed --commit-file -` likewise).
  So the choice fell entirely to the tie-break, not the acceptance bar.
- `committed` is the only candidate with a first-party `.pre-commit-hooks.yaml` (`stages: [commit-msg]`, `language: python` prebuilt-wheel — the same mechanism as the repo's existing `rumdl` remote hook); `convco`/`cocogitto` return 404 for that file, so each would have needed `brew`/`mise` PATH provisioning.
  This made `committed` self-provisioning via `prek install` with no PATH dependency — decisive.
- `committed` only enforces conventional format with `style = "conventional"`; its defaults (`subject_capitalized`, `subject_length = 50`, `style = "none"`) reject the repo's lowercase conventional subjects, so `committed.toml` disables those and sets `subject_length = 120`, `line_length = 0`, and `allowed_types` aligned with release-please.
- The load-bearing `!`-placement rejection was verified **live** through the installed prek hook (rejected `feat!(pi-subagents): bad placement test`, exit 1), not just via the binary; the config validated cleanly against `HEAD~80..HEAD` of real history.
- No npm devDependency was added (the gate is a prek remote-repo hook), so the `fallow unused-dev-dependencies` risk the plan flagged did not materialize — `fallow dead-code` is clean.
- The `mise` `[tools]` distribution path the plan listed for `cocogitto`/`convco` was not needed, since `committed` won.
- Pre-completion reviewer: **PASS** — ready for `/ship-issue`.
  No WARN findings (the 3 `useTemplate` biome infos in pi-permission-system are pre-existing and unrelated).
