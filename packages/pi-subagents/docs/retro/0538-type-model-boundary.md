---
issue: 538
issue_title: "pi-subagents Phase 20 Step 4: type the model boundary"
---

# Retro: #538 — pi-subagents Phase 20 Step 4: type the model boundary

## Stage: Planning (2026-07-08T00:00:00Z)

### Session summary

Planned Phase 20 Step 4: typing the `Model<any>` boundary through `model-resolver.ts`, `spawn-config.ts`, `runtime.ts`, and `service-adapter.ts` to remove two file-level `eslint-disable` headers and drop `resolveModel` / `service-adapter.spawn` off the fallow high-complexity list.
Verified the SDK exports a usable `Model` type (`@earendil-works/pi-ai`) with typed `id`/`name`/`provider`, and that `@typescript-eslint/no-explicit-any` is off, so `Model<any>` is lint-clean and matches four sibling modules' convention.
Produced a two-refactor-commit + one-docs-commit plan and committed it.

### Observations

- **`Model<any>` vs `Model<Api>`**: chose `Model<any>` to match the issue, the roadmap, and four existing modules, despite `Model<Api>` being strictly more precise (it matches the real `ModelRegistry` class return types exactly).
  Convention-consistency won; not surfaced to the operator as it was explicitly specified.
- **Forced commit coupling**: retyping `resolveInvocationModel`'s `parentModel` parameter to `Model<any> | undefined` breaks the `spawn-config.ts` call site at typecheck (a `{ id; name? }` is not a `Model<any>`), so `model-resolver.ts` + `spawn-config.ts` + `runtime.ts` must land in one commit. `service-adapter.ts` is independent (its own `spawn` path, injected `resolveModel`) and is a separate commit.
- **`ModelInfo.modelRegistry: unknown` → `ModelRegistry | undefined`** required `resolveInvocationModel` to accept `ModelRegistry | undefined` with a new no-registry guard.
  The guarded path is unreachable mid-session and previously would have thrown a `TypeError`; converting an unreachable crash into a typed error result is internal hardening, kept as `refactor:` (not `fix:`), preserving the refactor-only / release-neutral framing.
- **Test-fixture migration**: registry typing forces `MODELS` / stub returns from partial literals (`{ id, provider }`) to full `Model<any>` objects.
  Planned a shared `test/helpers/make-model.ts` builder (landed with its first consumer to avoid a fallow `unused-exports` flag), rather than `as unknown as` casts.
- **`ParentSnapshot.model` deferred**: a separate `unknown` thread at the SDK-capture boundary; typing it cascades into session-config assembly and sits behind a genuine SDK gap.
  Left as a Non-Goal, not filed (roadmap does not name it; nothing speculative filed).
- **Architecture-doc convention**: prior Phase 20 steps append a `Landed:` note per step and leave the Phase-19-end discovery/health-metrics snapshot untouched; the plan follows this.
  The path is release-excluded, so the `docs:` landing commit does not cut a release.
