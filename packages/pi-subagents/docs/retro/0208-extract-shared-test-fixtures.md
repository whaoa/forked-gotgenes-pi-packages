---
issue: 208
issue_title: "Extract shared test fixtures to reduce test duplication"
---

# Retro: #208 — Extract shared test fixtures to reduce test duplication

## Stage: Implementation — TDD (2026-05-25T21:00:00Z)

### Session summary

Completed all 10 TDD steps plus a type-fix commit.
Created 4 new files (`runner-io.ts`, `runner-io.test.ts`, `ui-stubs.ts`, `ui-stubs.test.ts`) and migrated 7 existing test files.
Test count grew from 884 → 913 (+29 tests in new helper unit tests).

### Observations

- Vitest v4 changed `vi.fn()` without implementation annotation to type `Mock<Procedure | Constructable>`, which is NOT assignable to specific function signatures in production interfaces.
  The fix was to add typed implementation annotations (`vi.fn((_path: string): boolean => false)`) to all vi.fn() stubs in the shared factories.
  This was a new friction point not anticipated in the plan.
- The plan's `assemblerOverrides` parameter in `createRunnerIO()` was removed because the `??` union typing caused `Mock<Procedure | Constructable> | Mock<specific-fn>` which TypeScript couldn't resolve as assignable to `RunnerIO`.
  No consumer test actually used the override parameter, so removing it simplified both the implementation and the type story.
- The `findAgentFile` signature in `AgentFileOps` is `(name: string, dirs: string[])` — the second parameter is `string[]`, not a second string as initially assumed from test patterns.
  This was caught by `pnpm run check`.
- The `agent-config-editor.test.ts` migration removed the `import type { AgentConfig }` import that was still needed by `buildEjectContent` tests further down the file.
  Also caught by `pnpm run check`.
- `STUB_SNAPSHOT` replacement was safe: no consumer test asserts on snapshot field values.
  The `mockSnapshot` in `agent-manager.test.ts` had `systemPrompt: "parent prompt"` vs `STUB_SNAPSHOT`'s `"test prompt"` but this caused no test failures.
- Architecture doc was updated to reference `test/helpers/` (correcting `test/fixtures/` from the original entry).

## Stage: Planning (2026-05-25T20:00:00Z)

### Session summary

Analyzed the three heaviest test clone families identified by fallow and designed a 10-step TDD plan to extract shared factories into `test/helpers/`.
Decided to follow the existing `test/helpers/` convention rather than the `test/fixtures/` directory mentioned in the issue and architecture doc.

### Observations

- Issue #131 (closed) already extracted `createMockSession`, `createToolDeps`, and `createTestRecord` — this issue targets the remaining duplication.
- The `createRunnerIO` factory in `agent-runner.test.ts` and `agent-runner-extension-tools.test.ts` includes stale `buildMemoryBlock` and `buildReadOnlyMemoryBlock` stubs that no longer match the `AssemblerIO` interface — the shared factory will clean these up as a side benefit.
- Session mock factories in the runner tests are structurally specialized (each serves a different test purpose) and were explicitly scoped as non-goals — extracting them would create a confusing multi-mode factory.
- The `agent-runner-extension-tools.test.ts` uses a mutable `agentConfigMock.current` pattern that doesn't fit into a shared static factory — only `createRunnerIO` is shared from that file.
- `STUB_SNAPSHOT` from `stub-ctx.ts` can replace all 5 local `ParentSnapshot` definitions — verified no test asserts on the specific field values.
- The `agent-manager.test.ts` internal duplication (~42 repetitive spawn calls) is best handled with local `spawnBg()`/`spawnFg()` helpers rather than cross-file extraction.
