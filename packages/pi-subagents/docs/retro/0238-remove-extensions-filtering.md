---
issue: 238
issue_title: "Remove extensions filtering from pi-subagents (Phase 14, Step 2)"
---

# Retro: #238 — Remove extensions filtering from pi-subagents

## Stage: Planning (2026-05-27T01:31:01Z)

### Session summary

Produced a 6-step TDD plan for narrowing `extensions` from `true | string[] | false` to `boolean` across `AgentConfig`, `ToolFilterConfig`, `filterActiveTools`, custom agent frontmatter parsing, UI serialization, and tests.
The plan mirrors the structure of the completed #237 plan (Step 1 of Phase 14) and explicitly defers `filterActiveTools` collapse to #239.

### Observations

- The `pkg:pi-permission-system` label on this issue is intentional context (pi-permission-system becomes the sole tool-policy authority) but all code changes are in pi-subagents.
- The `inheritField()` helper is shared between `extensions` and `skills` parsing — it cannot be simplified since `skills` still supports `string[]`.
  The plan coerces at the call site instead.
- After removing the `Array.isArray(extensions)` branch, the `builtinToolNameSet.has(t)` check in `filterActiveTools` becomes logically redundant (both branches return `true`), but simplifying further is #239's scope.
- Only 2 tests are removed and 3 updated; the boolean paths (`true`/`false`) are well-covered and unchanged.
