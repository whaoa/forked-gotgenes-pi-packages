---
issue: 477
issue_title: "pi-permission-system: collapse the two external-directory gates onto one AccessPath policy check (Phase 6 Step 5)"
---

# Retro: #477 — Collapse the two external-directory gates onto one AccessPath policy check

## Stage: Planning (2026-06-26T00:00:00Z)

### Session summary

Planned Phase 6 Step 5: collapse the duplicated `external_directory` policy logic in `describeExternalDirectoryGate` and `describeBashExternalDirectoryGate` into a shared helper, now that `AccessPath` ([#476], Step 4) exists.
Produced a two-step TDD plan (one atomic refactor commit + one docs commit) at `packages/pi-permission-system/docs/plans/0477-collapse-external-directory-gates.md`.
Confirmed the issue is the release-batch tail — it ships now alongside Step 4's held-open release PR.

### Observations

- **Design fork surfaced via `ask_user`** — the two gates have genuinely different control flow (single-tool: one path, always emits a descriptor, infra-bypass + boundary check; bash: N paths, filters uncovered, early-bypasses, picks worst).
  Asked the operator whether the helper should be one combined function over `AccessPath[]` (literal issue wording) or two focused functions sharing a private per-path core.
  Operator chose **two focused functions** — `resolveExternalDirectoryPolicy` (the single [#418]-prone line, used by the single gate) and `selectUncoveredExternalPaths` (bash gate; delegates to the per-path core and owns `pickMostRestrictive`).
  Rationale: worst-selection is inherently bash-only, and a combined result object would be read only in part by each consumer (dependency-width smell).
- **Not breaking** — pure behavior-preserving internal refactor; no config, output, or default change.
- **`fallow dead-code` forces atomicity** — the helper exports must land with both gate consumers in one commit, mirroring the same coupling [#476] hit; a pure-addition helper commit would fail the CI dead-code gate.
- **Orphaned-import trap flagged** — removing the bash gate's inline loop orphans three imports (`AccessPath`, `PermissionCheckResult`, `pickMostRestrictive`); `tsc` does not error on unused type imports, so the plan calls them out explicitly for the implementer and pre-completion reviewer.
- **Behavior-preserving, so no gate-test rewrites** — existing gate and integration tests stay green unchanged; only a new `external-directory-policy.test.ts` is added.
  Verified no README or package-SKILL symbol references break (both reference user-facing behavior, not the gate internals).

[#418]: https://github.com/gotgenes/pi-packages/issues/418
[#476]: https://github.com/gotgenes/pi-packages/issues/476
