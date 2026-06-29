---
issue: 503
issue_title: "pi-permission-system: migrate the service/RPC path queries onto AccessPath (Phase 7 Step 2)"
---

# Retro: #503 — Migrate the service/RPC path queries onto AccessPath (Phase 7 Step 2)

## Stage: Planning (2026-06-29T15:29:08Z)

### Session summary

Planned Phase 7 Step 2: route the `Symbol.for()` service (`LocalPermissionsService.checkPermission`) and the deprecated event-bus RPC (`permissions:rpc:check`) path queries through `AccessPath` so external policy queries for `path` / `external_directory` / path-bearing surfaces match the lexical aliases ∪ canonical set the gates do (the [#486] / [#502] parity).
The design routes both consumers through the **resolver** (`resolve(intent)`) rather than `manager.check`, so the resolver becomes the sole `path-values` producer — the premise Step 5 ([#506]) decides the boundary against.
Produced a three-step plan (two breaking `feat!:` migrations — service then RPC — plus docs) at `docs/plans/0503-service-rpc-access-path.md`.

### Observations

- **Routing through the resolver is roadmap-blessed, not just cleaner.**
  The manager's `check` accepts only `ResolvedAccessIntent` (`tool | path-values`) and never imports `AccessPath`.
  Having the service/RPC build a `path-values` intent themselves would make them a *second* `path-values` producer, contradicting Step 5's ([#506]) explicit premise.
  Emitting `access-path` to `resolver.resolve` (the single unwrap site) is the intended design and a clean 1:1 substitution for today's `manager.check(intent, sessionRules.getRuleset())` — the resolver subsumes the dropped `SessionRules` dependency.
- **Discovered a latent gap the migration fixes for free.**
  `buildInputForSurface` only wires the value into `external_directory` (returns `{ path }`); for `path` and the path-bearing tools it returns the catch-all `{}`, so a query like `checkPermission("read", "/p")` today drops the path and evaluates `["*"]` (asserted by `test/service.test.ts`).
  Building an `AccessPath` for the whole `PATH_SURFACES` set fixes this drop as a natural consequence — folded into the breaking surface, not deferred.
- **Two breaking `feat!:` commits, each independently green.**
  Step 1 migrates the service (moves the `resolver` const up in `index.ts`, leaves the RPC on its old deps); Step 2 migrates the RPC (reuses the moved-up resolver).
  Splitting avoids a single oversized commit while keeping each compilable — the constructor/deps changes each have a single production call site (`index.ts`).
  The helper `buildAccessIntentForSurface` lands in Step 1 with the service as its first consumer, so `pnpm fallow dead-code` never sees it unused.
- **`#502` was the template.**
  Loading the [#502] plan/retro gave the `access-path` intent shape, the `node:fs` `realpathSync` mock convention, and the [#502] lesson that a type-only parameter change can yield a *hollow red* under esbuild — flagged so Step 1/2's reds exercise the new behavior (canonical match), not just the new signature.
  Also carried forward the [#502] caution to run `fallow dead-code` for a stale suppression.
- **`buildInputForSurface` stays exported** — it is the `tool`-branch input builder inside `buildAccessIntentForSurface` and is imported by `test/service.test.ts`; its `external_directory` branch becomes test-only but is not dead (still exported + imported).
- **Skipped the `ask_user` gate:** operator-authored issue, unambiguous and roadmap-blessed proposal; the only design nuance (resolver-injection vs. a localized swap) is settled by Step 5's premise, not a genuine open choice.
- **Release:** Step 2 of batch "symlink-resistant-path-matching" (tail = Step 3, [#504]); mid-batch → defer.
  The breaking `feat!:` commits land on `main` and auto-batch; the major-bump release cuts when Step 3 lands.
