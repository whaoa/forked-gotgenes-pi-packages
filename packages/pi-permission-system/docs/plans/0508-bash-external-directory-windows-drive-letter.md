---
issue: 508
issue_title: "fix: bash external_directory gate misses Windows drive-letter absolute paths"
---

# Recognize Windows drive-letter paths in the bash path classifiers

## Release Recommendation

**Release:** ship independently

This fix is a standalone bug fix, not part of a release batch.
It ships on its own `fix:` release.
It is **sequenced after [#510]** (thread an injected platform/path-semantics seam through the bash path pipeline): #508 lands on the corrected seam rather than carrying its own platform plumbing.
The trailing `docs:` commit is a hidden changelog type that batches into the same release.

## Problem Statement

On Windows / MSYS2, a bash command that references a file by a native drive-letter absolute path bypasses the `external_directory` gate, while the same file accessed through the `read` / `write` tools is correctly gated.
The strict path-candidate classifier `classifyTokenAsPathCandidate` (`src/access-intent/bash/token-classification.ts`) — the one feeding the `external_directory` bash gate — only recognizes Unix-style absolute paths (`/…`), home-relative paths (`~/…`), and parent-traversal paths (`..`).
A Windows drive-letter path starts with a letter, so it is silently dropped before the gate ever sees it.

Two sub-cases differ in which surfaces miss them:

- `C:/Windows/win.ini` (forward slashes) is dropped by the strict classifier but already accepted by the broader `path` classifier (`classifyTokenAsRuleCandidate`, because it contains `/`).
  So it is missed only by the `external_directory` gate.
- `D:\secrets\password.txt` (backslashes) contains no `/`, no leading `.`, and no `..`, so it is dropped by **both** classifiers.

The format used to reference a path should not be a way to escape the working-directory boundary check.

## Goals

- The strict classifier recognizes Windows drive-letter absolute paths in both separator forms (`C:/…` and `C:\…`), so the `external_directory` bash gate sees them.
- The broader classifier also recognizes the backslash drive form (`D:\…`), so a `path`-surface rule applies to drive paths consistently across separator forms (the forward-slash form already reaches it via the `/` branch).
- The fix lands on [#510]'s injected platform/path-semantics seam: absoluteness, containment, and canonicalization are decided by the injected flavor, so the newly-admitted drive tokens route correctly on Windows (absolute → outside-CWD check) and on POSIX (relative → in-CWD gating) with no per-#508 platform plumbing.
- POSIX behavior is unchanged: a drive-shaped token resolves as the real in-CWD relative path it denotes (`cat C:/foo` → `./C:/foo`) and stays gated by the `path` surface as it is today.

This is a non-breaking bug fix (`fix:`).
It closes a permission bypass; the gate's documented intent already covers these paths.
On POSIX there is no observable change; on Windows a previously-ungated drive path now correctly triggers the `external_directory` prompt — the intended behavior of the gate.

## Non-Goals

- The platform/path-semantics seam itself (threading an injected flavor through the projection, `AccessPath`, `normalizePathForComparison`, `canonicalizePath`, and converting `isRelativeCandidate` from the hand-rolled `startsWith("/")` to the injected `isAbsolute`) is [#510], not this issue.
  #508 depends on it and assumes it has landed.
- The bare-filename `path`-surface gap (`cat id_rsa`, `cat key.pem`) is tracked separately by [#509] and is out of scope here.
- No POSIX advisory warning for "this token looks like a Windows path on a POSIX host."
  Dropping such a token would *reduce* POSIX path-surface coverage of the real in-CWD access; the focused fix keeps gating it.
  Not filed as a follow-up — no concrete need named.
- `token-collection.ts`, `command-enumeration.ts`, and `program.ts` logic is unchanged by #508 — the fix is confined to classifier shape recognition (the projection/`program.ts` changes belong to [#510]).

## Background

Relevant modules (`src/access-intent/bash/`):

- `token-classification.ts` — two pure classifiers (`classifyTokenAsPathCandidate` strict, `classifyTokenAsRuleCandidate` broad) sharing a private `rejectNonPathToken` prelude.
  Pure string-shape matching, no platform branch (Refs [#289], [#476]).
- `cwd-projection.ts` — `projectExternalPaths` (feeds `external_directory`, filters through the strict classifier) and `projectRuleCandidates` (feeds the `path` surface, filters through the broad classifier).
  After [#510], its absoluteness / containment / canonicalization decisions are driven by the injected platform flavor instead of the host-bound `node:path` import and the hand-rolled `startsWith("/")`.
  The literal-only guard for a relative candidate under an unknown `cd` base (Refs [#393]) is preserved by [#510].

Key existing facts that shape the design:

- The platform-sensitive decision ("is `C:/foo` absolute?") lives in `node:path` (`path.win32.isAbsolute("C:/foo") === true`, `path.posix.isAbsolute("C:/foo") === false`) and, after [#510], is reached through the injected flavor.
  The bug #508 fixes is purely that the strict classifier drops the token before resolution.
- The `rejectNonPathToken` prelude already lets drive paths through: `C:/Windows/win.ini` and `D:\secrets\password.txt` survive it (the `URL_PATTERN` requires `://`, so a single-slash `C:/…` is not a URL; backslash paths contain no metacharacter sequence).
  Only the **acceptance gate** drops them.
- AGENTS / `code-design`: do not read `process.platform` inside library/utility functions.
  Drive-letter *shape* recognition is platform-independent string matching (no `process.platform`); the platform-dependent *absoluteness* decision is delegated to the injected flavor from [#510].

## Design Overview

### Two separate questions, two separate seams

The change relies on a clean separation of two distinct questions:

1. **"Is this token shaped like a path worth gating?"**
   — platform-independent, owned by the classifiers (this issue).
   A drive-letter shape (`<letter>:` followed by `/` or `\`) is recognized unconditionally on every platform.
   On POSIX this is harmless: the token resolves as a real in-CWD relative path and is gated by the `path` surface as today.
2. **"Is this path absolute (resolve base-independently) or relative (resolve against the effective `cd` base)?"**
   — platform-dependent, delegated to the injected platform flavor ([#510]).

Conflating them into a shared helper used by both classifier and projection would be the wrong abstraction — shape recognition is inclusive and platform-independent, absoluteness is exclusive and platform-dependent.
[#510] establishes seam 2; #508 adds the missing case to seam 1.

### Shape recognition (classifiers)

A private module constant in `token-classification.ts`:

```typescript
/** Windows drive-letter absolute path: a drive letter, a colon, then a separator. */
const WINDOWS_DRIVE_PATH_PATTERN = /^[a-zA-Z]:[/\\]/;
```

The pattern requires a **separator** after `<letter>:`, so it matches the absolute forms (`C:/…`, `C:\…`) but not drive-relative `C:foo` (which `node:path` also treats as *not* absolute — correct to leave as an ordinary token).
The single-letter restriction means multi-letter schemes (`https:`, `mailto:`) never match; a single-letter scheme with `//` (`c://x`) is already rejected by `URL_PATTERN` earlier in the prelude.

Both classifiers gain a branch returning the token when the pattern matches:

- `classifyTokenAsPathCandidate` — new acceptance branch (the core `external_directory` fix; previously dropped both forms).
- `classifyTokenAsRuleCandidate` — new acceptance branch (covers the backslash form `D:\…`; the forward-slash form already matched via `token.includes("/")`, but the explicit branch makes both forms first-class and order-independent of the `/` check).

### Routing on the [#510] seam

Once the classifier admits a drive token, [#510]'s injected flavor routes it:

| Token                        | Host flavor | base       | Branch   | Outcome                                              |
| ---------------------------- | ----------- | ---------- | -------- | ---------------------------------------------------- |
| `C:/Windows/win.ini`         | win32       | known(cwd) | resolved | `C:\Windows\win.ini`, outside CWD → flagged          |
| `D:\secrets\password.txt`    | win32       | known(cwd) | resolved | absolute, outside CWD → flagged                      |
| `C:/projects/app/inside.txt` | win32       | unknown    | resolved | inside CWD → not flagged (no over-flag)              |
| `C:/Windows/win.ini`         | posix       | known(cwd) | resolved | `<cwd>/C:/Windows/win.ini`, inside CWD → not flagged |
| `cat C:/foo` (path surface)  | posix       | any        | —        | real `./C:/foo`, gated by `path` surface as today    |

Because absoluteness is the injected flavor's `isAbsolute` (not a hand-rolled `startsWith`), the unknown-base over-flag that a naive classifier-only fix would introduce (a Windows-absolute drive path inside CWD wrongly taking the relative/unknown branch) does not occur — [#510] already routes it through the resolved branch with its inside-CWD check.

## Module-Level Changes

- `src/access-intent/bash/token-classification.ts`
  - Add private `WINDOWS_DRIVE_PATH_PATTERN` constant.
  - Add a drive-letter acceptance branch to `classifyTokenAsPathCandidate`.
  - Add a drive-letter acceptance branch to `classifyTokenAsRuleCandidate`.
  - Update the module/JSDoc summaries that enumerate accepted shapes to include the Windows drive-letter form.
- `test/access-intent/bash/token-classification.test.ts`
  - Add drive-letter acceptance cases for both classifiers (both separators, lowercase drive), plus negative cases pinning that `URL_PATTERN` still rejects `c://x` and that drive-relative `C:foo` (no separator) is not accepted by the strict classifier.
- Projection / end-to-end test (location depends on [#510]'s test layout — extend the existing projection suite or `bash-external-directory` coverage)
  - Drive the pipeline with the **win32** flavor injected by [#510] (no `vi.mock("node:path")`) and assert: a Windows-absolute drive path outside CWD is flagged (`C:/…` and `D:\…`); an inside-CWD drive path is not flagged (known and unknown base).
  - With the **posix** flavor, assert a drive-shaped token outside an in-CWD location is not flagged via `external_directory` and the real in-CWD `./C:/foo` access remains gated by the `path` surface.
- Documentation (descriptive, release-excluded):
  - `packages/pi-permission-system/docs/architecture/architecture.md` — update the `token-classification.ts` tree entry's classifier shape lists (`strict: /, ~/, ..` and the broad list) to include the Windows drive-letter form.
  - `.pi/skills/package-pi-permission-system/SKILL.md` — update the "Notes for Agents" line that enumerates the strict classifier's accepted shapes ("absolute, `~/`-relative, or `..`-traversal paths") to include Windows drive-letter paths.

A grep of `src/`, `test/`, the architecture doc, and the package SKILL confirms these are the only live references to the classifier's accepted-shape prose; the `docs/plans/*` and `docs/retro/*` mentions are historical records and are left unchanged.

## Test Impact Analysis

1. **New tests enabled.**
   Platform-independent classifier unit tests for the drive-letter shapes (both separators) in `token-classification.test.ts`.
   An end-to-end drive-letter assertion driven by [#510]'s injected win32 flavor — exercising the real classifier + projection on Windows semantics on a POSIX CI **without** module mocking.
2. **Redundant tests.**
   None.
   The classifier change is additive (no existing acceptance/rejection assertion changes), so every existing assertion in `token-classification.test.ts` and the projection/external-directory suites stays valid.
3. **Tests that must stay as-is.**
   The POSIX external-directory / projection suite is the regression guard that POSIX gating is unchanged; it must stay green untouched.
   The `rejectNonPathToken` shared-rejection tests (URL, `@scope`, regex-metachar, bare-slash) pin that drive recognition does not weaken the prelude.

## Invariants at risk

The fix touches `token-classification.ts` (Refs [#289] clone-elimination of the shared prelude).
The projection invariants it could interact with are owned and re-pinned by [#510]:

- **[#289]** — both classifiers delegate the shared rejection cases to `rejectNonPathToken`.
  Pinned by the `shared rejection: rejectNonPathToken` describe blocks (tested via both classifiers).
  The new drive branches are added to the **acceptance** gate after the prelude, so the prelude is untouched; the URL / bare-slash negative cases stay green.
- **[#393]** — a relative candidate under an unknown `cd` base stays literal-only.
  Preserved by [#510]'s seam: a genuinely-relative candidate is still "relative" on both flavors, so it still takes the literal-only branch; only a (base-independent) Windows-absolute drive path is routed to resolution, which is correct.
  Pinned by the unknown-base projection tests.
- **[#418]** — the boundary decision and dedup use the canonical form while the returned value is the lexical form.
  Unchanged: #508 adds candidates upstream of this logic.

## TDD Order

Prerequisite: [#510] has landed (the injected platform/path-semantics seam, including `isRelativeCandidate` using the injected `isAbsolute`).
If [#510] deferred the `isRelativeCandidate` conversion, fold that one-line change into step 1 below to avoid the unknown-base over-flag.

1. `fix:` Recognize Windows drive-letter paths in both classifiers.
   Red: add drive-letter acceptance tests to `token-classification.test.ts` (both classifiers, both separators, lowercase drive, plus negative `c://x` URL and drive-relative `C:foo` cases) and the end-to-end win32-flavor assertions (outside-CWD `C:/…` and `D:\…` flagged; inside-CWD drive path under known and unknown base not flagged).
   Green: add `WINDOWS_DRIVE_PATH_PATTERN` and the acceptance branch to both classifiers; update their shape-listing JSDoc.
   Run `pnpm run check` and the full package suite.
   Commit: `fix(pi-permission-system): gate Windows drive-letter paths in bash external_directory (#508)`.

2. `docs:` Update descriptive docs for the new accepted shape.
   Update the `architecture.md` `token-classification.ts` tree entry and the `SKILL.md` "Notes for Agents" classifier-shape line to include Windows drive-letter paths.
   Commit: `docs(pi-permission-system): note Windows drive-letter paths in bash classifier docs (#508)`.

## Risks and Mitigations

- **[#510] not yet landed.**
  #508 is sequenced after [#510]; do not start until it is merged.
  Mitigation: if [#510] is delayed and the fix is urgent, #508 can fall back to the standalone approach (local `isAbsolute` delegation in `isRelativeCandidate` plus a file-scoped `vi.mock("node:path")` win32 test), but that re-introduces the drift and test fragility [#510] removes — prefer waiting.
- **[#510]'s final API shape differs from this plan's assumption** (a `PathSemantics` object vs. a bare `NodeJS.Platform`).
  Mitigation: the plan references the seam abstractly ("the injected flavor"); adapt the test's injection call to [#510]'s actual entry-point signature at implementation time.
- **Drive recognition weakens the rejection prelude.**
  Mitigation: the drive branches are added only to the acceptance gate, after `rejectNonPathToken`; the existing URL / `@scope` / regex-metachar / bare-slash rejection tests stay as guards.

## Open Questions

None blocking.
The scope (both classifiers, drive-letter-prefix detection, delegate platform decisions to [#510]'s seam, keep POSIX gating) is confirmed.
The only external dependency is [#510] landing first.

[#289]: https://github.com/gotgenes/pi-packages/issues/289
[#393]: https://github.com/gotgenes/pi-packages/issues/393
[#418]: https://github.com/gotgenes/pi-packages/issues/418
[#476]: https://github.com/gotgenes/pi-packages/issues/476
[#509]: https://github.com/gotgenes/pi-packages/issues/509
[#510]: https://github.com/gotgenes/pi-packages/issues/510
