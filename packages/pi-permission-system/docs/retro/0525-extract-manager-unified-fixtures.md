---
issue: 525
issue_title: "pi-permission-system: extract shared fixtures from permission-manager-unified.test.ts"
---

# Retro: #525 — Extract shared config-harness fixtures from `permission-manager-unified.test.ts`

## Stage: Planning (2026-07-05T00:00:00Z)

### Session summary

Planned Phase 8 Step 1: extracting the repeated config-harness scaffolding from the 3,745-line `test/permission-manager-unified.test.ts` into the shared `test/helpers/manager-harness.ts`.
Inventoried the seven file-local factories and their call-site counts (`makeManagerWithConfig` alone has 62), plus 11 inline `sessionRules` literals and the two `platform: "win32"` sites that must keep the in-memory loader factory exported independently.
Produced a 7-step behavior-preserving refactor plan (six `test:` extraction commits, one `docs:` roadmap-completion commit) and committed it as `0525-extract-manager-unified-fixtures.md`.

### Observations

- This planning session's file is deliberately separate from the pre-existing `0525-phase-8-roadmap.md` retro, which belongs to the roadmap-planning session (its frontmatter has no `issue:` field; it is the phase retro that happens to share the number of the first-filed issue).
- Design decision: collapse the two factories that merely re-shape an existing builder's input (`makeManagerWithConfig`, `makeManagerWithScopes`) into thin delegators over `createManager` / `createManagerWithProject`, so the clone disappears rather than relocating; move the three genuinely distinct patterns (missing-config, in-memory, agentDir) as new named builders.
- Rejected extracting the repeated test act/assert bodies (agent-frontmatter blocks at ~2494 / ~2523) — the `testing` skill is explicit that the repeated system-under-test call is the subject, not duplication to remove.
- Scoped out the two single-instance inline blocks (MCP-settings ~2270, `PI_CODING_AGENT_DIR` ~2911): they are not clones and carry test-specific extra setup, so no follow-up issue is warranted.
- Release nuance recorded in the plan: roadmap tag is `Release: independent`, but every commit is `test:` (hidden changelog type), so the plan lands on `main` and auto-batches into the next release-bearing change rather than cutting one itself.
- Current `fallow dupes` shows only 3 clone pairs in the file (fewer than the roadmap's 24 groups — the file has evolved); the plan targets the harness patterns structurally rather than chasing the stale count.
- No `ask_user` gate used: operator-authored issue, unambiguous named target, decisions within normal implementation latitude.
