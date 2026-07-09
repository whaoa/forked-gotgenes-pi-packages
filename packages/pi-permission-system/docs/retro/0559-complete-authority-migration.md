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
