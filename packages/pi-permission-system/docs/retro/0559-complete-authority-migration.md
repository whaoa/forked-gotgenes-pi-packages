---
issue: 559
issue_title: "pi-permission-system: complete the authority/ directory migration"
---

# Retro: #559 — pi-permission-system: complete the authority/ directory migration

## Stage: Planning (2026-07-09T00:00:00Z)

### Session summary

Planned Phase 9 Step 5: relocating the five remaining escalation/forwarding/subagent modules (`permission-dialog.ts`, `subagent-registry.ts`, `subagent-lifecycle-events.ts`, `permission-forwarding.ts`, `forwarding-manager.ts`) from the flat `src/` root into `src/authority/`, mirroring their test files into `test/authority/`.
This is a behavior-preserving mechanical move — the operator's own issue, unambiguous — so the `ask_user` gate was skipped.
Plan committed at `packages/pi-permission-system/docs/plans/0559-complete-authority-migration.md`; recommends a single atomic `refactor:` commit (ship independently, hidden changelog type).

### Observations

- The root `eslint.config.js` `local-rules/no-parent-relative-imports` rule flags only `../` imports and auto-fixes them to `#src/`/`#test/` aliases; same-directory `./sibling` imports are permitted, which is why the moved modules and `index.ts` use `./`.
  So `eslint --fix` + `tsc` mechanically enforce most of the import rewrites — the plan leans on the green suite as the full correctness proof.
- Import-rewrite rules split into six categories (Design Overview): the subtlety is that `#src/` aliases are package-root-absolute, so an importer's specifier changes because the *target* moved, not because the importer moved; whereas same-dir `./` refs among the five co-moving modules stay put.
- Decided to move the five test files into `test/authority/` to match the established `src/authority/foo.ts` ↔ `test/authority/foo.test.ts` convention from Steps 1–4 — the issue only names src modules, but the mirror is the standing pattern.
- Explicitly excluded `docs/architecture/v3-architecture.md`: it is a frozen pre-`authority/` snapshot (last touched at #314, no `authority/` subtree at all), so patching two stale tree lines would leave it internally inconsistent.
  Left as a historical artifact.
- Current-state doc grep surfaced three files to update alongside the move: `architecture.md` (tree + Step 5 `✅` + Mermaid node), `subagent-integration.md` (2 prose paths), and the `package-pi-permission-system` SKILL (2 prose paths).
  Remaining hits are frozen plans/retros/history.
- Folded the doc updates into the `refactor:` commit rather than a separate `docs:` commit — a `docs:` commit touching `docs/architecture/` is an unhidden changelog type here and would cut an unwanted release; the package skill also wants the roadmap step-complete marker in the implementation commit.
- No follow-up issues filed — scope is fully mechanical with no deferred work.

## Stage: Implementation — Build (2026-07-09T00:00:00Z)

### Session summary

Executed the single-step plan in one atomic commit (`c6c84ca7`): `git mv`d the five modules (`permission-dialog.ts`, `subagent-registry.ts`, `subagent-lifecycle-events.ts`, `permission-forwarding.ts`, `forwarding-manager.ts`) and their five test files into `src/authority/` / `test/authority/`, rewrote every import per the plan's six categorized rules, and folded in the architecture-doc, `subagent-integration.md`, and SKILL.md updates.
`tsc`, `eslint`, the full suite (2310 tests), and `pnpm fallow dead-code` all passed after the move; pre-completion review returned PASS.

### Observations

- The plan's Design Overview correctly predicted all internal import rewrites for the five moved files (categories 1–3), but its Module-Level Changes importer enumeration (category 4/5) missed three root-level files with same-directory `./` imports of the moved modules: `src/permission-gate.ts` (`./permission-dialog`), `src/session-approval.ts` (`./permission-forwarding`), and `src/permission-session.ts` (`./forwarding-manager`).
  `tsc` caught all three immediately (`Cannot find module`) since they weren't in the `#src/permission-dialog`-style grep the plan ran — a same-dir `./` import to a module that later moves out of the directory has no `#src/` marker to grep for.
  Fixed inline as part of the same commit; not a plan deviation requiring a stop, since `tsc` made the gap immediately visible and mechanical to close.
- Deliberately left the Phase 9 phase-level archival (History table row, new `docs/architecture/history/phase-9-*.md` file, condensed phase summary paragraph matching the Phase 1–8 convention) out of scope, even though all five Phase 9 steps are now `✅`.
  The plan's Non-Goals explicitly excluded `docs/architecture/history/*`, and that archival is a substantially larger, separate task (a new summary doc) that wasn't reviewed at planning time.
  Marked only the Step 5 heading, `Landed:` line, and Mermaid node per the plan's explicit scope.
- Reviewer verdict: **PASS** — no warnings.
  Confirmed pure move (import-specifier-only diffs), correct tree-connector glyphs, both invariant-pinning tests (Step 3 forwarded-broadcast, Step 4 grant-scope) still exercised.
- No steps remain; ready for `/ship-issue`.
