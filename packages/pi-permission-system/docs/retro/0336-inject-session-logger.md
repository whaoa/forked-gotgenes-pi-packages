---
issue: 336
issue_title: "Make the logger injectable; drop createSessionLogger(runtime)"
---

# Retro: #336 — Make the logger injectable; drop `createSessionLogger(runtime)`

## Stage: Planning (2026-06-06T21:30:54Z)

### Session summary

Produced a numbered implementation plan for Phase 4 Step 3 (Track B): repurpose `createSessionLogger` to take narrow deps (`globalLogsDir` + a `getConfig` thunk + a `notify` sink) instead of the whole `ExtensionRuntime`, fold the JSONL-writer composition + warning-dedup + `warn` into that one factory, expose the built logger as `runtime.logger`, and drop the five `.bind(runtime)` adapters in `index.ts`.
The plan is a two-step lift-and-shift (Step 1 adds `runtime.logger` while keeping the old runtime methods as thin delegators; Step 2 removes the old methods + the `.bind` adapters), keeping the repo green between commits.

### Observations

- The logger ↔ `ConfigStore` cycle (logger needs config toggle; `ConfigStore` writes through the logger) is broken cleanly with a lazy `getConfig: () => configStore.current()` thunk — the logger object is fully built before `ConfigStore`; only the config *value* is read lazily.
  This replaces the existing stub-then-reassign forward reference, not just relocates it.
- Naming is intentionally left split: consumer deps keep `writeReviewLog` / `writeDebugLog` field names mapped to `logger.review` / `logger.debug` values.
  Unifying the names is [#338]'s job — flagged as an Open Question.
- Logger construction stays in `createExtensionRuntime()` (not `index.ts`) because `ConfigStore` is built there until [#337] dissolves the runtime; moving it now would pre-empt and re-do [#337].
- The architecture doc's Step 3 target list (`session-logger.ts`, `logging.ts`, `index.ts`) omits `runtime.ts`, but removing the `writeDebugLog` / `writeReviewLog` fields and the inline logger construction unavoidably edits `runtime.ts` — noted in the plan.
  `logging.ts` itself needs no edit (it already takes narrow options and has no runtime reference); it is merely composed by the new `createSessionLogger`.
- `SessionLogger` interface (`debug` / `review` / `warn`) is unchanged, so `decision-reporter.ts`, `handlers/lifecycle.ts` (sole `warn` caller), `permission-session.ts`, and the test fixtures need no edits — keeps blast radius small.
- Grep confirms `runtime.writeDebugLog` / `writeReviewLog` live only in `runtime.ts`, `index.ts`, `test/runtime.test.ts`; `createSessionLogger` only in `index.ts`, `session-logger.ts`, `test/session-logger.test.ts`.
- `[#335]` (ConfigStore) is complete and provides the `RuntimeContextRef` seam reused by the notify sink and the `ConfigReader` for the debug toggle.

[#337]: https://github.com/gotgenes/pi-packages/issues/337
[#338]: https://github.com/gotgenes/pi-packages/issues/338
