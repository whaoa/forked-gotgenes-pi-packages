---
issue: 508
issue_title: "fix: bash external_directory gate misses Windows drive-letter absolute paths"
---

# Retro: #508 — fix: bash external_directory gate misses Windows drive-letter absolute paths

## Stage: Planning (2026-06-27T00:00:00Z)

### Session summary

Planned the fix for the bash `external_directory` gate missing Windows drive-letter absolute paths (`C:/…` and `C:\…`).
The operator's questions drove the scope progressively deeper: from "which classifier(s)" → "detect the platform?"
→ "what makes this change easy (Kent Beck)?"
→ "is there an architectural root cause?".
The investigation surfaced that the package has a half-threaded, ambient platform dependency (`process.platform` and the host-bound `node:path` import read in ~6 interior modules), which is the real root cause behind the recurring Windows-path bugs.
Filed that as a separate architecture issue, #510, and rebased #508's plan to land on #510's clean seam.

### Observations

- **Scope decisions (via `ask_user`).**
  Confirmed: recognize both separator forms in *both* classifiers (not just the strict one); detect drive paths by a drive-letter prefix regex (`/^[a-zA-Z]:[/\\]/`), not "any backslash"; keep gating drive-shaped tokens on POSIX (do not warn/drop — dropping would *reduce* POSIX `path`-surface coverage of the real in-CWD `./C:/foo` access).
- **No `process.platform` branch.**
  The platform-sensitive decision ("is `C:/foo` absolute?") already lives in `node:path` (`path.win32` vs `path.posix`).
  Shape recognition is platform-independent string matching; absoluteness delegates to the injected flavor.
  This satisfies the package's own `code-design` rule against reading `process.platform` in utility functions.
- **Architectural root cause → #510.**
  `path-utils.ts` `isPathWithinDirectory` and `rule.ts` already use an injectable `platform: NodeJS.Platform = process.platform` parameter (with the testability rationale in the doc comment), but the seam was never threaded end-to-end: `normalizePathForComparison` hard-codes `process.platform` inline, `canonicalizePath` / `AccessPath.forPath` take no flavor, and `cwd-projection.ts` imports host-bound `node:path` and hand-rolls `startsWith("/")`.
  Threading an injected `PathSemantics`/platform flavor through the pipeline is the structural correction that makes #382/#345/#418/#508 and future Windows forms (UNC, `\\?\`, drive-relative) a single-home change.
- **Sequencing (operator choice).**
  Refactor first (#510), then rebase #508 onto the clean seam.
  On that seam #508 collapses to: add the drive-letter shape to the classifiers; the `isRelativeCandidate` → injected `isAbsolute` conversion and the win32 testability both belong to #510 (no `vi.mock("node:path")`).
- **Tidy-first insight.**
  The naive classifier-only fix would briefly over-flag an inside-CWD drive path under an unknown `cd` base (a Windows-absolute path mislabeled "relative" by the hand-rolled check). #510's `isAbsolute` delegation eliminates that window, so #508 needs no transient cleanup.
- **`#509`** is the sibling issue (bare-filename `path`-surface bypass) split from the same parent #494 — explicitly out of scope here.

## Stage: Planning refresh — post-#510/#511 (2026-06-28T00:00:00Z)

### Session summary

## 510 and #511 are closed; the platform/path-semantics seam landed as `PathNormalizer` (`src/path-normalizer.ts`), and the old `cwd-projection.ts` is now the class-based `bash-path-resolver.ts` holding `this.normalizer`

Refreshed the #508 plan from its abstract "injected flavor" wording to the concrete API and confirmed the scope reduction the plan anticipated.

### Observations

- **#510 deferred the `isRelativeCandidate` conversion**, exactly the contingency the original plan flagged. `foldCd` already delegates to `this.normalizer.isAbsolute`, but the module-level free function `isRelativeCandidate` (`bash-path-resolver.ts`, two call sites: `projectExternalPaths`, `buildRuleCandidatePath`) still hand-rolls `!startsWith("/") && !startsWith("~")`. #508 folds in converting it to a private method delegating to `this.normalizer.isAbsolute` — load-bearing, since the projection's relative/unknown decision (not just `foldCd`) gates the over-flag.
- **Testability is clean as predicted.** `BashProgram.parse(command, normalizer)` and `extractExternalPathsFromBashCommand(command, normalizer)` take a `PathNormalizer`; `bash-external-directory.test.ts` already builds `new PathNormalizer(process.platform, cwd)`. #508's Windows assertions construct `new PathNormalizer("win32", cwd)` — no `vi.mock("node:path")`.
- **#508 now reduces to two production edits + docs**: drive-shape recognition in both classifiers (`token-classification.ts`, unchanged by #510) and the `isRelativeCandidate` conversion (`bash-path-resolver.ts`).
  Single `fix:` commit + `docs:` commit.
- Next step: `/tdd-plan`.
