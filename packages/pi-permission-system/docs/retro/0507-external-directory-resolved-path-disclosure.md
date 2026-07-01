---
issue: 507
issue_title: "fix(pi-permission-system): external-directory prompt shows the typed path, not the resolved path that triggered the gate"
---

# Retro: #507 — external-directory prompt shows the typed path, not the resolved path that triggered the gate

## Stage: Planning (2026-06-30T00:00:00Z)

### Session summary

Planned a message-clarity fix that discloses the resolved (canonical, symlink-followed) path in the external-directory prompt and denial messages as `(resolves to '<canonical>')`, shown only when it differs from the typed path.
The plan adds an `AccessPath.resolvedAlias()` accessor as the single home for the lexical-vs-canonical comparison, a shared `resolvesToSuffix` helper plus `ExternalPathDisclosure` type in `denial-messages.ts`, and threads the resolved form through both gates into all external-directory message variants.
Filed as `packages/pi-permission-system/docs/plans/0507-external-directory-resolved-path-disclosure.md`; four TDD cycles, `Release: ship independently`.

### Observations

- Scope decision (via `ask_user`): the operator chose to cover **all** external-directory message variants (ask + deny + no-UI + user-denied), not just the four call sites the issue named — the `buildUnavailableBody` external_directory body carries the identical "inside path called outside working directory" contradiction, and once `resolvedPath` is in `DenialContext` the marginal cost is ~2 lines each.
- The comparison must be `value()` (lexical absolute) vs `boundaryValue()` (canonical absolute), **not** the raw typed relative string vs canonical — the typed string is relative and would always differ.
  Encapsulated on `AccessPath` as `resolvedAlias()`.
- Both lexical and canonical forms are win32-lowercased (`path-normalization.ts`), so a case-only Windows difference yields no spurious disclosure; `canonicalizePath` returns its input unchanged for non-symlink/unresolvable paths, so `resolvedAlias()` is `undefined` exactly when there is no distinct target.
- Non-breaking: message builders and `DenialContext` are internal (not exported from `index.ts`); gating decisions, review-log values, and session-approval patterns are unchanged.
  Kept all commits `fix:` (including the internal `resolvedAlias()` enabler) so the issue ships as one patch, not a minor bump.
- Type coupling drove the cycle boundaries: changing `DenialContext.bash_external_directory.externalPaths` to `ExternalPathDisclosure[]` breaks its sole producer + consumer + inline test constructions together, so the bash prompt/denial/gate/tests land in one commit.
- Not a roadmap step (Phase 7 complete); surfaced while investigating #493 (closed — the bypass concern was already handled by dual-match).
