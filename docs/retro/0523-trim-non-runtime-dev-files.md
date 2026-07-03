---
issue: 523
issue_title: "Trim non-runtime dev files from published packages"
---

# Retro: #523 — Trim non-runtime dev files from published packages

## Stage: Planning (2026-07-03T00:00:00Z)

### Session summary

Produced a cross-package build plan (`docs/plans/0523-trim-non-runtime-dev-files.md`) to stop shipping non-runtime dev files (`test/`, `tsconfig.json`, `vitest.config.ts`, `AGENTS.md`, `.pi/`, `.prettierignore`) to npm.
The operator chose to standardize **all 8 packages** on a single `files` allowlist mechanism and remove every `.npmignore`, rather than following the [#484] per-package allowlist-vs-denylist split.
Plan is packaging-only: seven commits (six `build(<pkg>):`, one `docs:` for AGENTS.md), each verified by `pnpm pack` inspection.

### Observations

- Author is `gotgenes` (the operator), so the proposed direction was treated as the working hypothesis; still ran the `ask-user` gate because the mechanism choice was a genuine fork.
- Clarified with the operator that [#484] only narrowed `pi-permission-system`'s allowlist; the four `.npmignore` denylists came from an earlier commit (`3e1bf9c6`), and AGENTS.md codified the split.
  The operator elected to supersede that split with a single allowlist mechanism.
- Key safety check: `#test/*` in each `package.json` is a **self-referencing** internal subpath alias, not a consumer of another package's published `test/`; the only cross-package dep (`pi-subagents-worktrees` → `pi-subagents`) resolves through `exports`, so dropping `test/` from every tarball is safe.
- The surviving `.npmignore` files in `pi-permission-system` and `pi-subagents` are fully redundant once an allowlist exists (they target paths outside the allowlist), so deleting them yields an identical tarball — verified by design, to be confirmed per-step with `pnpm pack`.
- These are `build:` commits (hidden changelog type): the plan's Release Recommendation is "ship independently" but explicitly notes the work will not cut its own release — it auto-batches into the next `feat:`/`fix:` release (Refs #479 guidance).
- No architecture-roadmap, README, or package-skill references to `#523` need updating; only AGENTS.md's docs-in-distribution convention changes.
- Next stage is `/build-plan` (no test cycles — packaging config and docs only).

[#484]: https://github.com/gotgenes/pi-packages/issues/484
