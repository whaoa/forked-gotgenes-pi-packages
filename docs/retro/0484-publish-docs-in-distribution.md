---
issue: 484
issue_title: "Bad URL in docs"
---

# Retro: #484 — Bad URL in docs

## Stage: Planning (2026-07-03T00:15:00Z)

### Session summary

Planned the fix for a third-party report that `@gotgenes/pi-permission-system`'s `docs/configuration.md` 404s on jsdelivr/pi.dev.
Root cause: the package's `files` allowlist omits `docs/`, so no documentation ships to npm and every README `docs/...` link (and the logo) breaks on the CDN.
The operator broadened scope to a repo-wide convention — ship user-facing docs, never ship internal working docs — so the plan is cross-package (`docs/plans/0484-...`).

### Observations

- **Third-party issue, two `ask_user` gates.**
  Author `johnsyin-nextbe` ≠ operator, so I confirmed direction/scope rather than implementing the issue body verbatim.
  First `ask_user` settled scope (cross-package convention) + inclusion mechanism (selective allowlist).
  The operator then steered toward a denylist mid-plan.
- **Inclusion vs. exclusion asymmetry drove the final design.**
  A denylist (`.npmignore`) cannot *add* files an allowlist omits, so `pi-permission-system`'s missing docs must be fixed by editing its `files` array.
  Over-publishing (internal `docs/plans`/`docs/retro` leaking) is best fixed with a `.npmignore` denylist.
  The plan uses each mechanism where it is effective rather than forcing one everywhere.
- **Deliberately kept scope to docs.**
  Introducing `files` allowlists to the four no-files packages would have incidentally dropped `test/`/`tsconfig`/dev config (scope creep) and risked dropping a runtime file.
  Chose targeted `.npmignore` (`docs/plans`, `docs/retro`) instead — lowest risk, docs-only.
- **`pi-colgrep` and `pi-github-tools` already conform** (allowlist omits `docs`, no user docs) — no change; verification-only.
- **Verification is `pnpm pack` tarball diffs**, not Vitest — this is a `/build-plan`, no test cycles.
- **Release:** ship independently — `pi-permission-system` cuts a `fix:` patch; the other packages' `build:`/`docs:` commits are hidden and batch.
- **Filed follow-up #523** for the separate over-publishing of non-runtime dev files (`test/`, `tsconfig.json`, `vitest.config.ts`, `AGENTS.md`, `.pi/`), explicitly out of scope here.
- **Open risk to watch in build:** whether `.npmignore` prunes inside `pi-subagents`'s `files`-allowlisted `docs` dir; plan documents a fallback (narrow the `docs` entry) arbitrated by the pack diff.
