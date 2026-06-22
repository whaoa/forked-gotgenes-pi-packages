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
