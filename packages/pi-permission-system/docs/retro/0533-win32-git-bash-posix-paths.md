---
issue: 533
issue_title: 'Windows/Git Bash: POSIX paths like /dev/null and /tmp are normalized as C:\dev\null / C:\tmp'
---

# Retro: #533 — Windows/Git Bash: POSIX paths like /dev/null and /tmp are normalized as C:\dev\null / C:\tmp

## Stage: Planning (2026-07-04T00:00:00Z)

### Session summary

Researched Git Bash/MSYS path semantics before planning (the operator explicitly asked for research over a band-aid), confirmed direction via two `ask_user` rounds, and produced `docs/plans/0533-win32-git-bash-posix-paths.md`.
The plan introduces a bash-surface-only POSIX-token interpretation layer on win32: exact device paths preserved, `/c/` drive mounts translated, other POSIX absolutes handled as literal-only external paths.

### Observations

- **Decisive research finding:** Pi core always executes bash via Git Bash on Windows (`pi/packages/coding-agent/src/utils/shell.ts`), and core's `normalizeNulRedirects()` (pi#4731 / pi#4751) rewrites `> NUL` → `> /dev/null` on win32 before spawning the shell — so core actively produces the exact token this package mangles into `C:\dev\null`.
  This turned the issue from "special-case a path" into "the bash surface's platform is MSYS on win32".
- **Operator confusion resolved:** the prior win32 issues (#382 case folding, #508 drive-letter tokens) are *not* contradicted — they handle Windows-shaped tokens, which Git Bash also accepts; this change adds branches for POSIX-shaped absolute tokens that previously fell through into `win32.resolve()`.
- **Scope decisions (operator-confirmed):** full POSIX-token branch (not device-only); `/tmp` and other non-mount POSIX absolutes as literal-only external paths (deterministic; `external_directory` rules like `/tmp/*` match the typed form), explicitly rejecting `cygpath` shell-outs and `os.tmpdir()` mapping (bash-flavor-dependent, ambient state).
- **Design refinement during planning:** device recognition must be bash-surface-only, not in the shared normalization primitives — Node `fs` on win32 genuinely resolves `/dev/null` to `C:\dev\null`, so a *tool-input* `/dev/null` should keep prompting (least privilege).
  This forced the projection in `BashPathResolver` to derive the external decision from `AccessPath.boundaryValue()` (new `isBoundaryOutsideWorkingDirectory`) instead of re-normalizing the lexical string — a small structural improvement that removes a double derivation.
- **Latent bug found while planning:** `projectExternalPaths` dedups on `boundaryValue()`, which is `""` for every literal-only path — two distinct literal-only externals would collapse to one.
  The plan fixes the dedup key (`canonical || lexical`) in cycle 3.
- **Evidence for `fix:` classification:** `docs/configuration.md` line ~469 already promises "OS device paths (`/dev/null`, …) are always excluded" — current win32 behavior violates the package's own documented contract.
- Third-party issue (author `ThreeIce`); the `ask_user` direction gate was applied as required, and the operator's answers (not the issue body) drove the Goals.
- No follow-up issues filed — the deferred alternatives (cygpath, `%TEMP%` mapping) were declined, not deferred.
