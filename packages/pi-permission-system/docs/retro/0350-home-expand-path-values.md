---
issue: 350
issue_title: "~ and $HOME patterns footgun"
---

# Retro: #350 — ~ and $HOME patterns footgun

## Stage: Planning (2026-06-08T19:40:13Z)

### Session summary

Diagnosed the reported footgun: path **patterns** are home-expanded by `compileWildcardPattern` (via `expandHomePath`), but tool-call and bash path **values** flow through `normalizeInput` raw, so a `~/.ssh/config` value never matches a `~/.ssh/*` deny rule — a silent permission bypass.
Produced a numbered plan (`docs/plans/0350-home-expand-path-values.md`) with two coordinated fixes that both reuse the existing `expandHomePath`, plus TDD cycles and doc updates.

### Observations

- Root cause is asymmetry, not a missing feature: expansion happens on one side of the match only.
  The fix is to home-expand path **values** symmetrically at the single choke point, `normalizeInput`.
- Both `describePathGate` and `bash-path.ts` route through `permissionManager.checkPermission` → `normalizeInput`, so one change in `normalizeInput` fixes the cross-cutting `path` surface for tool calls **and** bash, plus per-tool path patterns.
- Decision (`ask_user`): code fix, not docs-only — this is an under-matching `deny` bypass, the worst failure mode for a least-privilege gate; the docs example (`~/.ssh/*`) is correct intent.
- Decision (`ask_user`): home-expand values **only**, not full cwd-canonicalization.
  Patterns are not cwd-resolved today (so glob patterns like `*.env` match anywhere); home-expand-only keeps that and avoids regressing relative patterns.
- Secondary fix included: `normalizePathForComparison` currently expands `~` but not `$HOME`; routing it through `expandHomePath` brings the `external_directory` surface (and bash external-path / skill-read) to `$HOME` parity.
  Flagged in Open Questions as splittable if review wants tighter scope.
- Existing tests stay green: current `input-normalizer.test.ts` and `external_directory` integration cases use non-home or already-absolute values, which `expandHomePath` leaves untouched.
  No existing assertion needs flipping; the change only adds previously-missing matches.
- Home-expansion tests must mock `node:os` (`vi.hoisted` + `vi.mock` with a `default` key) as in `expand-home.test.ts`.
