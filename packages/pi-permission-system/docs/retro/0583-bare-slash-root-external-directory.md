---
issue: 583
issue_title: "pi-permission-system: bare-slash `find /` bypasses the external_directory gate"
---

# Retro: #583 — bare-slash `find /` bypasses the external_directory gate

## Stage: Planning (2026-07-13T00:00:00Z)

### Session summary

Traced the `find /` bypass to the `/^\/+$/` bare-slash branch in `rejectNonPathToken` (`src/access-intent/bash/token-classification.ts`), the single point that drops `/`, `//`, `///` before all three bash classifiers.
Confirmed downstream resolution needs no change — a `/` candidate resolves external (`isBoundaryOutsideWorkingDirectory("/")` is `true`, `/` is not a safe system path) and `//`/`///` normalize to `/`.
Wrote a single-cycle `fix:` plan that removes the branch and inverts the encoding tests.

### Observations

- Classified as a non-breaking `fix:`, not `fix!:` — matches sibling gate-tightening fixes #481 and #490, which both added new prompts under `fix:`.
  No config default changes; the fix only makes the `external_directory` gate honor its already-documented `ask` default where a token escaped it.
- The `echo /` now-prompts behavior change is deliberate and consistent with the command-agnostic path model (`echo /etc/passwd` already prompts).
  Surfaced it explicitly in Risks rather than treating it as an alternative; no `ask-user` gate needed since author is the operator and the direction is unambiguous.
- The two `bash-external-directory.test.ts` "guard is still needed" tests encode the removed branch as necessary defense-in-depth — they are deleted, not migrated, since their premise is now false.
- Left the historical plan `0533-win32-git-bash-posix-paths.md:151` parenthetical about the bare-slash rejection unchanged (completed plan record; its `//server/share` conclusion stays correct).
- Ships independently — no roadmap step references #583.

## Stage: Implementation — TDD (2026-07-13T19:41:00Z)

### Session summary

One red→green→commit cycle implemented the whole fix: removed the `/^\/+$/` bare-slash branch from `rejectNonPathToken` (`src/access-intent/bash/token-classification.ts`) so a bare `/`, `//`, `///` reaches the external_directory and path surfaces, and inverted/rewrote the tests that encoded the dropped behavior.
Tidy-First assessor reported no preparatory tidying warranted (single-branch subtraction, already-atomic tests).
Test count unchanged at 2387 (net-zero: 2 unit tests inverted in place, 7 integration tests rewritten 1:1 including a new `find /` regression test replacing the two deleted "guard is still needed" tests).

### Observations

- Empirically confirmed during GREEN that `//` and `///` normalize to lexical `/`, so the resolved external set is `["/"]` for all three — the plan's predicted expectation held exactly.
- No deviations from the plan. `find /` now resolves to external root `["/"]`; verified `pnpm run check`, root `pnpm run lint`, full `pnpm run test` (2387), and `pnpm fallow dead-code` all green; no lockfile changes.
- Pre-completion reviewer: WARN (single non-blocking finding) → resolved.
  It caught a stale "seven shared rejection cases" comment in the test file header (line 13) that mirrored the source-module comment I had already corrected to "six"; fixed and amended into the fix commit before it was pushed.
- Deliberately left the historical plan `0533-win32-git-bash-posix-paths.md` parenthetical unchanged, as the plan specified.
