---
issue: 345
issue_title: "external_directory gate uses lexical path normalization (no symlink resolution) — in-cwd symlink escapes the cwd boundary"
---

# Retro: #345 — Canonicalize paths before the external-directory containment check

## Stage: Planning (2026-06-08T21:59:34Z)

### Session summary

Planned a fix for the lexical-containment flaw in the `external_directory` gate: containment is decided on lexically-normalized paths with no symlink resolution, so an in-cwd symlink escapes cwd (symptom 1) and a symlinked cwd flags its own paths as external (symptom 2).
The plan introduces a best-effort `canonicalizePath` helper (`src/canonicalize-path.ts`) and routes both containment computations — `isPathOutsideWorkingDirectory` (tool-call surface) and `BashProgram.externalPaths` (bash surface) — through it.
Filed at `packages/pi-permission-system/docs/plans/0345-canonicalize-path-containment.md`.

### Observations

- Both reported repros (`cat ./link/hosts`, `/tmp/...`) actually run through `bash` → `BashProgram.externalPaths`, not the tool-call gate; the tool-call gate (`isPathOutsideWorkingDirectory`, used by `read`/`write`/`edit`/`find`/`grep`/`ls`) carries the identical flaw.
  User confirmed fixing both surfaces.
- Issue [#350] already shipped `$HOME` expansion in `normalizePathForComparison`, so the "secondary gap" the issue mentions is already closed — the plan only addresses symlink canonicalization.
- IO approach decided via `ask_user`: direct `fs.realpathSync` in a small isolated module, tested with `vi.mock("node:fs")` (mirroring the existing `node:os` mock in `path-utils.test.ts`), rather than threading a `realpath` dependency through the pipeline.
  User pushed back on DI threading as overkill and was right that vitest can mock the builtin.
- Key safety property: the best-effort walk-up returns the lexical input unchanged when no ancestor exists, so the integration tests that use synthetic non-existent paths (`/test/project`) keep current behavior with no mock and need no edits.
- Kept `normalizePathForComparison` lexical (skill-read / skill-prompt matching is not a security boundary); canonicalization is surgical to the two containment paths.
- Deferred (Non-Goals): the optional path-pattern deny-evasion surface (symlink alias vs `*.env`) and skill-read canonicalization.
- TOCTOU is inherent and accepted — the fix narrows the gap, does not close it.

## Stage: Implementation — TDD (2026-06-08T22:46:22Z)

### Session summary

Completed all 4 TDD cycles: added `src/canonicalize-path.ts` + 8-test suite; switched `isPathOutsideWorkingDirectory` and `describeExternalDirectoryGate` to canonical comparison; canonicalized `BashProgram.externalPaths`; updated architecture docs.
Test count rose from 1858 to 1873 (+15) across 91 test files.
Pre-completion reviewer returned PASS.

### Observations

- **Loop form deviation:** The plan used `while (true)` but `@typescript-eslint/no-unnecessary-condition` rejected it.
  During the user review pause, refactored from a `for (;;)` walk-up to a split-based `for (let i = parts.length; i >= 0; i--)` loop — explicit bound, no `toReversed()`, no root-detection heuristic.
  Cleaner and correct.
- **Critical bash classifier discovery:** The plan's bash symlink-escape test used `cat ./link/hosts`.
  `classifyTokenAsPathCandidate` only accepts absolute, `~/`-relative, and `..`-traversal tokens — it rejects `./relative` paths entirely, so the bash external-directory gate never processes them.
  The correct test surface is the absolute form `cat /projects/my-app/link/hosts`.
  Noted in commit body.
  This means `cat ./link/hosts` is not fixed by canonicalization; it is a separate classifier-scope gap.
- **macOS platform hazard:** `test/bash-external-directory.test.ts` (top-level integration suite) uses real paths like `/etc/hosts`.
  On macOS, `/etc -> /private/etc`, so `realpathSync("/etc/hosts")` returns `/private/etc/hosts`, breaking all expected-value literals.
  Added an identity `node:fs` mock to the file — not anticipated in the plan.
  Any test file importing `bash-program.ts` transitively needs this mock after canonicalization was added.
- **WARN from reviewer:** `canonicalNormalizePathForComparison` reads `process.platform` directly (consistent with pre-existing `normalizePathForComparison` pattern); not a blocker.
- Pre-completion reviewer verdict: PASS.
