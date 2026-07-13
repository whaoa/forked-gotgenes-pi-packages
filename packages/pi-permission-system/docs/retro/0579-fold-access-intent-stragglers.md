---
issue: 579
issue_title: "pi-permission-system: fold access-intent stragglers into src/access-intent/"
---

# Retro: #579 — Fold the access-intent stragglers into `src/access-intent/`

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Planned Phase 11 Step 1: relocating the four flat-root access-intent modules (`input-normalizer.ts`, `mcp-targets.ts`, `tool-input-path.ts`, `path-surfaces.ts`) into `src/access-intent/`, a green-preserving `refactor:` move with no behavior change.
Produced a two-step plan at `docs/plans/0579-fold-access-intent-stragglers.md` — one atomic `refactor:` commit for the module + test moves and all import rewrites, then a `docs:` commit for the architecture doc, package skill, and Phase 11 Step 1 completion marker.

### Observations

- Operator confirmed (via `ask_user`) that the four **test** files should move into `test/access-intent/` too, to preserve the test-tree mirror — the issue itself scoped only `src/`, but `test/access-intent/` already exists (`access-path.test.ts`, `tool-kind.test.ts`).
- Enumerated the full import inventory with a bare-name grep across `src/` and `test/` (not `#src/`-only), catching both `#src/` alias importers and `./`-relative flat-root importers per the [#559] lesson — eleven source importers plus five test files.
- Intra-`access-intent/` convention verified against existing modules: same-directory siblings use `./<sibling>`, cross-directory imports use the `#src/` alias.
  The plan follows that for the moved files and keeps each non-moving importer's existing style.
- Both pi-permission-system ESLint guards are unaffected: the `process.platform` `no-restricted-syntax` rule is a `src/**` glob (modules stay under it), and the `no-restricted-imports` ADR-0002 guard is file-scoped to `permission-manager.ts` (the move adds no `access-path` import).
  No `eslint.config.js` / `tsconfig` / `package.json` edit needed — the `#src/*` alias resolves subdirectories.
- Release is `independent` (not in the `shell-tool-aliases` batch); as a `refactor:` it auto-batches into the next release rather than cutting one.
- Next stage is `/build-plan` (code-touching but test-cycle-free — no red cycle, the relocated suites are the regression guard), which brackets with the `tidy-first-assessor` and `pre-completion-reviewer` subagents.

[#559]: https://github.com/gotgenes/pi-packages/issues/559
