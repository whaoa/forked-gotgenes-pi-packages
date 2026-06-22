---
issue: 459
issue_title: "Allow commands scoped to subdirectories."
---

# Retro: #459 — Allow commands scoped to subdirectories

## Stage: Planning (2026-06-22T00:00:00Z)

### Session summary

Planned issue #459 (a third-party request from `michaelmior` for a per-formatter `baseDir` that scopes a formatter to a subdirectory and runs it from that directory).
Through the `Decide` gate, the operator confirmed the docs-only direction: recommend the existing built-in `treefmt` (with `includes`/`excludes` globs) as the supported path and close the issue as solved by an existing feature, rather than adding a new `baseDir` runtime mechanism.
Wrote `packages/pi-autoformat/docs/plans/0459-treefmt-for-subdirectory-scoped-formatters.md` and committed it.

### Observations

- The proposed `baseDir` was rejected on design grounds, not just "use the existing tool": it conflates two concerns (scope filter + command `cwd`), and a singular `baseDir` cannot express one tool (e.g. `eslint`) used by several subprojects without redeclaring the formatter under synthetic names.
  The `pi-autoformat` batch-dispatch model (all touched files of a chain group passed to one invocation) also conflicts with a single per-formatter `cwd` when a turn spans multiple subprojects.
- `treefmt` per-formatter `includes` subsumes the scope-filter half; formatters walking up the tree for their own config subsume most of the `cwd` half — aligning with the package priority "trust formatters to discover their own project configs" and "prefer a documented config pattern over a new runtime mechanism."
- The operator initially recalled "a CLI tool we discovered while building this plugin" — that is `treefmt`/`treefmt-nix`, added in plan `0015`.
  The two `ask_user` rounds first identified the tool, then narrowed the direction once the `baseDir` design weaknesses were surfaced.
- Scope is a single doc file: `docs/configuration.md` gets a new subsection near the existing built-in-`treefmt` docs.
  No schema, loader, executor, README, or test changes.
  `docs/configuration.md` is not in the package `exclude-paths`, so the `docs:` commit is tracked but does not bump the version on its own.
- Next stage is `/build-plan` (docs-only, no TDD cycles).
  Issue close happens during `/ship-issue` with a comment explaining the `treefmt` path and the `baseDir` rejection.

## Stage: Implementation — Build (2026-06-22T00:00:00Z)

### Session summary

Executed the single-step docs-only plan: added a `#### Scoping formatters to subdirectories (monorepos)` subsection to `packages/pi-autoformat/docs/configuration.md`, placed after the existing `#### Built-in formatters` content.
The subsection documents `treefmt` `includes`/`excludes` globs (with a `treefmt.toml` example and a `"*": ["treefmt"]` wildcard chain), the per-subproject local-config-discovery note, and the rationale for declining a per-formatter `baseDir`.
Committed as `docs(pi-autoformat): document treefmt for subdirectory-scoped formatters (#459)`.

### Observations

- No deviations from the plan.
  Single step, single file changed; no schema, loader, executor, README, or test changes were needed (as planned).
- No `src/`/`test/`/`.ts` files touched, so `pnpm run test` / `pnpm run check` were not required; `pnpm run lint` (`biome` + `eslint` + `rumdl`) passed before and after the edit.
- Pre-completion reviewer: PASS — deterministic checks all green; doc accuracy verified against the existing built-in `treefmt` description and the wildcard-chain docs; conventional commits valid; forward/reverse documentation consistency PASS; code-design/test/mermaid/architecture sections SKIP (docs-only).
- Issue #459 has no formal acceptance-criteria section (it uses the feature-request template); close happens at `/ship-issue` with the `treefmt`-path explanation and `baseDir` rationale.
