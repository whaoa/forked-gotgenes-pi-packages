---
issue: 554
issue_title: "pi-session-tools: first test in read-session*/read-parent-session/list-session-files test files intermittently exceeds 5s testTimeout"
---

# Retro: #554 — pi-session-tools first test intermittently exceeds 5s testTimeout

## Stage: Planning (2026-07-07T00:00:00Z)

### Session summary

Planned a test-only fix for the intermittent 5s `testTimeout` flake in four `pi-session-tools` tool test files.
The root cause is a per-test `await import("#src/index")` inside every `it()` block; `src/index.ts` transitively pulls the heavy `@earendil-works/*` packages, and that transform/resolve cost (78–98% of the 5000ms budget) is paid inside the timed region on the first test of each isolated file.
The plan moves the import to a single static top-level `import sessionTools from "#src/index"`, shifting the cost to vitest's collection phase (outside `testTimeout`).

### Observations

- The fix hinges on vitest hoisting `vi.mock("node:fs", …)` and `vi.hoisted(...)` above a static import — verified as documented default behavior, but the plan's Step 1 converts one mocked file (`read-session-file.test.ts`) in isolation to confirm empirically before rolling across the other three.
- Scope confirmed as **single-package** despite two `pkg:*` labels (`pkg:pi-permission-system`, `pkg:pi-session-tools`).
  The `pi-permission-system` label reflects that the flaking CI runs happened to ship `pi-permission-system` changes; the actual fix is entirely in `pi-session-tools` test files.
- Only the four files importing `#src/index` ride the edge (confirmed by grep).
  `session-file.test.ts` uses per-test dynamic imports too but of `#src/session-file`, which pulls only node built-ins — left out of scope.
- Rejected the issue's fallback options (`testTimeout` bump / `beforeAll` hook) as Non-Goals; the primary fix removes the cost from the timed region entirely, so a timeout override would only mask the underlying edge.
- `test:` commits are a `hidden` changelog type, so this ships independently but will not cut a release on its own — it auto-batches into the next release.
