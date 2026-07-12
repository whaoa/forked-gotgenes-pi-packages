---
issue: 309
issue_title: "Unify the advisory checkPermission/RPC bash path with the gate's decomposed fidelity"
---

# Retro: #309 — Unify the advisory checkPermission/RPC bash path with the gate's decomposed fidelity

## Stage: Planning (2026-07-11T00:00:00Z)

### Session summary

Produced a five-step TDD plan (`docs/plans/0309-advisory-bash-decomposition-parity.md`) to route the synchronous advisory `LocalPermissionsService.checkPermission("bash", …)` through the gate's already-shared `resolveBashCommandCheck` orchestrator, backed by a warm-then-sync tree-sitter parse, with a cold-start whole-string fallback.
The plan preserves the synchronous public contract and ships as `feat:` (non-breaking strengthening) per the roadmap's recorded owner decision.

### Observations

- **Issue predates the current architecture.**
  The issue body references `src/service.ts` and `src/permission-event-rpc.ts` and the shape of `resolveBashCommandCheck` as future work.
  Since filing: #531 removed the event-bus RPC channel (service accessor is now the sole surface), the service is `LocalPermissionsService` (`src/permissions-service.ts`), and #308 already landed `resolveBashCommandCheck(command, commands: BashCommand[], …)` as the shared combiner.
  So the issue's step 2 ("extract the shared orchestration") is a no-op — the orchestrator already exists; the real remaining work is the warm-parser seam plus service routing.
- **Breaking classification resolved by the roadmap.**
  The advisory answer for chained bash commands changes on upgrade (technically observable-behavior-changing), but `docs/architecture/architecture.md` Phase 10 Step 4 records the owner's 2026-07-10 decision: `feat:` (not `feat!:`), `Release: independent`, noted in release notes, because no external consumer exercises bash advisory queries yet.
  Skipped the `ask-user` gate on that basis.
- **Layer boundary drove module placement.** `resolveBashAdvisoryCheck` imports `resolveBashCommandCheck` from `handlers/gates/`, so it lives at the service layer (`src/bash-advisory-check.ts`), not under `access-intent/` — keeping the domain layer free of a handler-layer import. `parseBashCommandsSync` stays in `access-intent/bash/` (pure over the parser + `collectCommands`).
- **`input-normalizer.ts` deliberately untouched** despite the roadmap target text naming it.
  The decompose-or-fallback decision returns a full `PermissionCheckResult` (most-restrictive over multiple resolves), which cannot live in an intent *builder*; keeping `buildAccessIntentForSurface` pure and branching in the service is cleaner.
  Noted as a deviation in Non-Goals.
- **Module-state persistence is a testing hazard.**
  `warmedParser` persists across tests in a file (and across same-cwd sessions in production, per the package SKILL).
  Plan adds a `resetWarmBashParser()` test hook and has the service test mock `bash-advisory-check` entirely to avoid cross-test leakage.
- **Cold-start fallback is the fail-closed floor.**
  The pre-warm window falls back to the exact pre-#309 whole-string match (never weaker); when warm, the advisory path inherits `resolveBashCommandCheck`'s #452 fail-closed and #306 nested-command handling for free.
