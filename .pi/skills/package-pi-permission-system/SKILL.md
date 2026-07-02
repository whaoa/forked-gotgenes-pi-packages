---
name: package-pi-permission-system
description: |
  Package-specific context for @gotgenes/pi-permission-system.
  Load when working on code, tests, or docs in packages/pi-permission-system/.
---

# pi-permission-system

Pi extension that enforces deterministic permission gates over tool, bash, MCP, skill, and special operations so the agent cannot silently exceed the policy a user has configured.

This package is a full fork of [`MasuRii/pi-permission-system`](https://github.com/MasuRii/pi-permission-system).
It began as a config-layout divergence (#10) and has since diverged substantially in config format, internal architecture, and permission model.
The `/permission-system` slash command name is the only upstream identity preserved.

Read `docs/plans/` before making architectural changes.
Pre-monorepo plans from the upstream fork live in `docs/plans/archive/` — issue numbers there refer to the upstream repo, not this monorepo.

`docs/architecture/architecture.md` tracks the improvement phases as a flat numbered step list plus a Mermaid graph — one issue per step, never a chain inside a single node label.
When a plan touches that roadmap, enumerate the whole phase: search dependents too (`gh issue list --search "#N"`), not just the issues the current one references.
When the implementation completes a numbered roadmap step, mark it complete in `docs/architecture/architecture.md` in the implementation doc-update commit (`/tdd-plan` step 7 / `/build-plan`), not a deferred `/ship-issue` commit — `✅` on both the step heading and its Mermaid diagram node, plus any stale health-metric/target rows in the same commit.
Deferring the marker to ship splits it from the work and risks it falling through entirely (Refs #479, #480).

## Implementation Priorities

- Default to least privilege — when in doubt, prompt (`ask`), do not silently allow.
- Enforce permissions deterministically; the same policy + same input must always produce the same decision.
- Keep config files the source of truth; do not bake policy into code.
- Hide denied tools from the agent before it starts (tool filtering + system-prompt sanitization).
- Keep block/ask/allow decisions reviewable: write to the permission review log by default.
- Preserve the `/permission-system` slash command name — renaming it is a breaking change.
- In the flat permission format, `permission["*"]` is the universal fallback; pattern ordering is last-match-wins.
- The four path layers (`path`, `external_directory`, per-tool, `bash`) compose with **most-restrictive-wins** across surfaces: a more-permissive rule on one surface cannot loosen a more-restrictive rule on another (`ask` > `allow`).
  So a `path` allow cannot suppress an `external_directory: ask` prompt — allow outside-CWD directories on `external_directory`, not `path`.
- Wildcard matching must be explicit and tested — silent over-matching is a permission bypass.
- Prefer config patterns over new runtime mechanisms.
  Mechanism is forever; docs are reversible.
- Treat any declared config field not read at runtime as a maintenance trap.

### Single source of truth for tool policy

Pi-subagents removed its `disallowed_tools` frontmatter field and `extensions: string[]` allowlist (pi-subagents Phase 14, #237, #238, #239 — shipped).
This package is the **sole authority** for tool access control.
Users migrating from `disallowed_tools` should use `permission:` frontmatter in agent definitions:

```yaml
# Before (pi-subagents, removed in Phase 14)
disallowed_tools: bash

# After (pi-permission-system)
permission:
  bash: deny
```

### Event-based subagent integration

`@gotgenes/pi-subagents` emits a child-execution lifecycle on `pi.events` (`subagents:child:*`); this package subscribes via `subscribeSubagentLifecycle` (`src/subagent-lifecycle-events.ts`) and registers/unregisters child sessions in the `SubagentSessionRegistry` on `session-created` / `disposed` (pi-subagents [#261], [ADR-0002]).
The dependency direction is inverted — pi-subagents has zero knowledge of pi-permission-system.
The `session-created` handler MUST stay synchronous: the core emits it on the same call stack right before `bindExtensions()`, and the event bus dispatches listeners synchronously, so a synchronous handler lands the registry entry before binding proceeds.

**The `SubagentSessionRegistry` is process-global.**
Access it via `getSubagentSessionRegistry()` (`src/subagent-registry.ts`), backed by `globalThis` + `Symbol.for("@gotgenes/pi-permission-system:subagent-registry")`.
This is necessary because each session's `ResourceLoader` creates its own `pi.events` bus: the parent emits `subagents:child:session-created` on its bus and only the parent's instance receives it.
The child's separate jiti instance runs on a different bus and never receives the event — but `getSubagentSessionRegistry()` returns the same global store, so the parent's registration is visible to the child when it checks `isSubagentExecutionContext()`.
Do not instantiate `new SubagentSessionRegistry()` in production code; use the accessor.
This lesson comes from issue [#296]: the regression where `permission-bridge.ts` was retired in favour of `pi.events` registration but the per-session bus split meant the child never saw the registration.

## Configuration

One unified config file per scope, following the `pi-autoformat` convention (`extensions/<id>/config.json`).

- **Global config**: `~/.pi/agent/extensions/pi-permission-system/config.json` (respects `PI_CODING_AGENT_DIR`)
- **Project config**: `<cwd>/.pi/extensions/pi-permission-system/config.json`
- **Per-agent overrides**: YAML frontmatter in agent definition files

Merge precedence: project overrides global; per-agent frontmatter overrides both.
The `permission` object uses deep-shallow merge; scalar fields use simple replacement.

- Schema: `schemas/permissions.schema.json`
- Example: `config/config.example.json`
- Keep schema, example config, `docs/configuration.md`, `README.md`, and TypeScript types/loaders aligned — changing one without the others is a bug.
- `docs/architecture/architecture.md` inline-copies the core `rule.ts` types (`Rule`, `RuleOrigin`, `Ruleset`).
  Adding or removing a field on one of these must update that listing too — a module-move check misses it, and only the pre-completion reviewer catches it otherwise.
- When removing a config field, keep the loader tolerant: detect the legacy key, emit a non-fatal config issue, and discard the value.
- When adding an optional field to `PermissionSystemExtensionConfig`, do not include it in `DEFAULT_EXTENSION_CONFIG` with an explicit `undefined` value — tests use `deepEqual` and it breaks equality.
- When adding a field to `PermissionSystemExtensionConfig`, also carry it through the loader's `UnifiedPermissionConfig` (`config-loader.ts`): parse it in `normalizeUnifiedConfig()` and merge it in `mergeUnifiedConfigs()`.
  A field on the runtime type but not the merge intermediate is silently dropped before runtime (the #332 / #347 bug class).
  After #356, omitting a field from `UnifiedPermissionConfig` that `normalizePermissionSystemConfig` reads is a **compile error** — `normalizePermissionSystemConfig` reads fields directly from the typed `UnifiedPermissionConfig` parameter, so `tsc` catches the gap immediately.
- When a config example sets a policy for `write`, include the same policy for `edit` — both tools modify files and users expect them gated together.

## Cross-Extension Integration

### Single-agent core

Pi is single-agent by design; multiple named agents are an external-extension concept (pi-subagents, pi-agent-router), not Pi core.
Per-agent `permission:` frontmatter is an extension bridge on this single-agent core — see `docs/architecture/architecture.md` design principle 9.
Do not propose pushing agent-awareness (an agents directory, frontmatter parsing) into the SDK or core.

### Jiti isolation

Pi's extension loader keeps each extension's module isolated — a variable set in this extension's module is invisible to other extensions.

**Module-scoped state no longer resets per session.**
Since [earendil-works/pi#5905] (shipped in pi-coding-agent — "cache extension imports for session switches"), the loader caches the imported factory function per `(extensionPath, cwd)`.
The factory is still **re-invoked** on every `/new` / `/resume` / `/fork` / `/import` switch (with a fresh `pi`/`ExtensionContext`), so everything constructed *inside* the factory body — `PermissionSession`, `SessionRules`, subscriptions, `pi.on(...)` registrations — is rebuilt fresh each session, and `session_shutdown` still fires.
But the module itself is imported only once per cwd; the cache clears only on `/reload` or a cwd change (`clearExtensionCache`).
So module-scoped mutable state (top-level `let`, module-level caches, memoized values like `getParser = memoizeAsyncWithRetry(...)` in `access-intent/bash/parser.ts`) now persists across same-cwd session switches instead of being reborn each session.
This is safe today (the package's module-scoped state is read-only lookup tables plus the stateless tree-sitter parser — persisting the parser is a win), but **do not park session-scoped or permission-relevant state at module level assuming a per-session reset** — it will leak between sessions in the same cwd.
Keep per-session state inside the factory closure (where it is rebuilt) or in the `session_start`/`session_shutdown`-driven lifecycle.
A regression guard lives in `test/composition-root.test.ts` ("session approvals do not leak across same-cwd session switches").

Shared communication channels:

- **`pi.events`** (the event bus) — for fire-and-forget broadcasts and RPC.
- **`globalThis` + `Symbol.for()`** — process-global by spec, survives jiti isolation.
  Use for direct service access.

The in-process implementation of `PermissionsService` is `LocalPermissionsService` (`src/permissions-service.ts`).
It and the event-bus RPC check handler (`permission-event-rpc.ts`) route policy queries through the `PermissionResolver`, not `PermissionManager` directly: a path-shaped surface (`path` / `external_directory` / `read` / `write` / `edit` / `grep` / `find` / `ls`) query builds an `AccessPath` via `buildAccessIntentForSurface` and emits an `access-path` intent, so external queries match the lexical ∪ canonical set the gates do (#503); the normalizer is fetched per call from the session (`getPathNormalizer()`), so the published service answers against the parent cwd.
The `session_start`-gated publication, #302 subagent-child guard, ready-event emit, and session teardown ordering are all owned by `PermissionServiceLifecycle` (`src/service-lifecycle.ts`), which is injected into `SessionLifecycleHandler`.
Changes to publication timing or teardown order should go through `PermissionServiceLifecycle`, not `index.ts`.

Do not propose module-scoped singletons or Node.js module-cache sharing as a cross-extension communication mechanism — module isolation keeps them invisible to other extensions.

[earendil-works/pi#5905]: https://github.com/earendil-works/pi/issues/5905

The `path` and `external_directory` gates are path-aware for **all** tools, not just the six built-ins (#352).
`getToolInputPath` (`src/tool-input-path.ts`) extracts a path for built-ins (`input.path`), MCP (`input.arguments.path`), and extension tools (default `input.path`, or a custom key via a registered extractor); `getPathBearingToolPath` stays built-in-only and now drives the per-tool gate's `AccessPath` (the pipeline builds `normalizer.forPath(getPathBearingToolPath(...))` and emits an `access-path` intent on the tool-name surface, #502), plus the raw decision/log value.
The `ToolAccessExtractorRegistry` (`src/tool-access-extractor-registry.ts`) mirrors `ToolInputFormatterRegistry`: one instance created in `index.ts`, its lookup threaded into `ToolCallGatePipeline`, its registrar exposed cross-extension via `PermissionsService.registerToolAccessExtractor`.
Extension/MCP path gating is default-on (no registration needed); per-tool path maps for extension tools (a custom extractor key that supplies the path via a registered `ToolAccessExtractor`) are a deferred follow-up.

## Testing

Shared test fixtures live in `test/helpers/`:

- `session-fixtures.ts` — real-instance builders for `PermissionSession` / `PermissionResolver` tests: `makeRealSession` (builds a real `PermissionSession` from per-collaborator fakes; returns `{ session, paths, logger, forwarding, permissionManager, sessionRules, configStore, gateway }`), `makeFakePermissionManager` (fake `ScopedPermissionManager` with `vi.fn()` stubs — unannotated return type for full mock access; exposes a single `check(intent, sessionRules?)` stub, the one resolution entry point since #478), `makeRealResolver` (real `PermissionResolver` over a fake manager + `SessionRules`; pass shared instances to connect it to a session's manager/rules), plus `makePaths` / `makeLogger` / `makeConfigStore` / `makeGateway` / `makeForwarding`.
  Tests exercising `resolveAgentName` must mock `active-agent` in their own file (the `vi.hoisted` / `vi.mock` pattern), since that mock is module-scoped.
- `handler-fixtures.ts` — `makeCtx`, `makeEvents`, `makeToolRegistry`, `makeToolCallEvent`, `makeCheckResult` (neutral default, override-driven), `makeHandler` (builds a **real** `PermissionSession` + `PermissionResolver` wired into the handler and pipelines exactly as `index.ts`; the `session` override bag maps `checkPermission` onto `permissionManager.checkPermission` and `getActiveSkillEntries` / `getInfrastructureReadDirs` / `getToolPreviewLimits` / `resolveAgentName` onto `vi.spyOn` overrides of the real session; accepts optional `tools: string[]` and `prompter: GatePrompter`; returns `{ handler, events, session, logger, toolRegistry, prompter, recorder, permissionManager, forwarding }` — `session.activate` is the real method, so assert `forwarding.start` instead), `makeSurfaceCheck` / `makeBashCommandCheck` (surface-/bash-dispatching `checkPermission` mocks — pass the result as `session.checkPermission`, applied to `permissionManager.checkPermission`), `getDecisionEvents`.
  `MockGateHandlerSession` now covers only the pipeline-input surface (`ToolCallGateInputs & SkillInputGateInputs`); the wide 17-field intersection mock and the standalone `makeSession` factory are gone (#341).
- `gate-fixtures.ts` — `makeDescriptor`, `makeGateRunner` (constructs a `GateRunner` with four role mocks and returns `{ runner, deps }` so tests can invoke `runner.run(...)` and assert on `deps.reporter.*`, `deps.resolve`, etc.; accepts optional `resolveResult: PermissionCheckResult` shortcut — wraps `resolve` in a `vi.fn` returning that value, taking precedence over the default allow result), `makeDenialDescriptor` (write-surface variant of `makeDescriptor` with a caller-supplied `DenialContext` — use when testing denial-message formatting), `makeReporter` (`DecisionReporter` mock with `writeReviewLog`/`emitDecision` vi.fn stubs), `makeResolver` (`ScopedPermissionResolver` mock — plain object with a single `vi.fn` `resolve` stub; pass a `PermissionCheckResult` to set its default return value; omitting the arg leaves it returning `undefined` so callers must call `mockReturnValue` or pass a result explicitly, #478), `makePathDispatchResolver` (resolver whose single `resolve` dispatches on the `AccessIntent` kind — `tool` keys on `intent.input.path`, `access-path` on any matching entry in `intent.path.matchValues()` — pass a `byPath` map and a `defaultResult`; since #486 the emitted union is `tool | access-path` only, #393, #478, #486), `makeTcc` (bash defaults: `toolName: "bash"`, `input: { command: "cat .env" }` — passing `{ input: { command: "cat .env" } }` explicitly is redundant and can be omitted), `makeGateCheckResult` (path-surface defaults: `toolName: "path"`, `source: "special"`, `origin: "global"`), `makeGateInputs` (mock of `ToolCallGateInputs` for `ToolCallGatePipeline` unit tests — stubs the three query methods `getActiveSkillEntries`, `getInfrastructureReadDirs`, `getToolPreviewLimits`; the resolver is now a separate `makeResolver(makeCheckResult())` passed as the first arg to `ToolCallGatePipeline` — `makeGateInputs` no longer stubs `resolve`), `makeSkillInputInputs` (mock of `SkillInputGateInputs` for `SkillInputGatePipeline` unit tests — single-method stub for `checkPermission`; returns `makeCheckResult()` by default), `makeNotifier` (`GateNotifier` mock — unannotated return type so callers retain full `vi.fn()` access on `warn`).
  `makeRunnerDeps` has been deleted; `GateRunnerDeps` no longer exists.
- `manager-harness.ts` — `createManager` (filesystem-backed `PermissionManager`), `createManagerWithProject` (two-level harness with global + project config dirs and per-level agent files; returns `{ manager, cleanup }` — use when testing project-level or project-agent precedence).
- `make-fake-pi.ts` — `makeFakePi` (composition-root harness): runs the real `piPermissionSystemExtension(pi)` factory against a fake `ExtensionAPI` with a real `createEventBus()`, an inspectable `handlers` map, captured `commands`, and a `fire(event, input, ctx)` driver.
  Use it for composition-root wiring tests (handler-registration completeness, shared-instance contracts, teardown, event ordering) — see `test/composition-root.test.ts`.
  Composition-root tests must `vi.stubEnv("PI_CODING_AGENT_DIR", <tmpdir>)` and clear both `Symbol.for()` global slots (`:service`, `:subagent-registry`) in `afterEach`, since the factory mutates process-global state.

Import from these instead of redefining factories inline.
When a call site needs different defaults from `makeCheckResult`, pass explicit overrides (e.g. `makeCheckResult({ state: "deny", matchedPattern: "*" })`).

Since #478 the manager and resolver each expose a single resolution method (`ScopedPermissionManager.check(intent)` / `ScopedPermissionResolver.resolve(intent)`), so the #393 false-green class is structurally impossible — there is no second method a fixture can stub-but-forget.
`makeHandler` routes the `makeSurfaceCheck` / `makeBashCommandCheck` override onto `permissionManager.check` via an intent→(surface, input) adapter: a `path-values` intent maps to `surfaceCheck(intent.surface, { path: intent.values[0] }, …)` so `path` / `external_directory` overrides apply to bash tokens and tool paths alike (#418).
An inline handler that mocks `permissionManager.check` directly must dispatch on `intent.kind` (`path-values` carries `values`, `tool` carries `input`) and `intent.surface`, or external-directory checks false-green to `allow`.
The gate emitting the intent picks the surface: since #486 every path gate emits `access-path` — the tool/bash path gates on `"path"` and the external-directory gates on `"external_directory"` — and since #502 the per-tool gate also emits `access-path` on the tool-name surface (`read`/`write`/`edit`/`grep`/`find`/`ls`); the resolver unwraps it via `AccessPath.matchValues()` to match a path's typed and symlink-resolved aliases, so the `path` surface and the per-tool surfaces now match the canonical form too (#418, #486, #502).
The gate-emitted `path-values` variant was removed; `path-values` survives only as the resolver-internal `ResolvedAccessIntent` form the string-based manager consumes (so `permissionManager.check` and the `makeHandler` adapter at line above still see `tool | path-values`).
This resolver-internal boundary is a deliberate, formalized seam, not transitional scaffolding (see `packages/pi-permission-system/docs/decisions/0002-path-values-string-boundary.md`, #506): the manager stays string-based and must not import `AccessPath` — a `no-restricted-imports` lint rule on `permission-manager.ts` guards it.

- Test permission resolution (allow/deny/ask decisions across tools, bash, MCP, skills, special).
- Test wildcard matching (bash patterns, skill globs) including over-match and under-match cases.
- Test policy merge precedence: global → project → per-agent frontmatter.
- Test system-prompt sanitization (denied tool lines narrowed out of the `Available tools:` listing, allowed tools preserved).
- Test the external-directory guard for path-bearing file tools, including extension and MCP tools (default-on path gating, #352).
- Test config loading, validation issues, and tolerance of deprecated keys.
- To test the file-based permission-forwarding round-trip (a subagent's `ask` reaching the parent), do not `await` the child's `pi.fire("tool_call", …)` directly — `PermissionForwarder.requestApproval` polls for a response with a 10-minute timeout when forwarding to the parent.
  Instead: fire without awaiting, poll the parent's `requests/` dir (`createPermissionForwardingLocation(forwardingDir, parentSessionId)`) for the child's request file, write an approval JSON to `responses/<id>.json`, then await the fire.
  See the `subagent registry sharing` test in `test/composition-root.test.ts`.

## Debugging

When investigating a reported bug:

1. Check the runtime environment: which extensions are loaded, from which paths, and whether any are loaded more than once.
2. Check `.pi/settings.json` and `~/.pi/agent/settings.json` for overlapping package entries.
3. Instrument only after confirming the bug reproduces in isolation.
4. When the bug involves path, filesystem, or platform semantics, check how `@earendil-works/pi-coding-agent` solves it first (local checkout or published source).
   Prefer Node `path` builtins (`path.relative`, `path.win32`/`path.posix`) over hand-rolled comparison; pi's containment idiom is `relative()` + a `..`/absolute-prefix check (case-insensitive on Windows).
   Platform handling has a single home: `PathNormalizer` (`src/path-normalizer.ts`), built at the session edge from the injected host `platform` + session `cwd` and exposed via `PermissionSession.getPathNormalizer()` (#510); the `getPlatform()` accessor was retired once both #511 and #502 folded their reads (#513).
   Hand the normalizer raw tokens (`forPath`/`forLiteral`/`isAbsolute`/`resolveBase`/`joinBase`/`isWithinDirectory`/`isOutsideWorkingDirectory`/`comparableValue`/`isInfrastructureRead`); do **not** read `process.platform` inside `src/` — an ESLint `no-restricted-syntax` guard scoped to `pi-permission-system/src` (exempting `index.ts`, the only reader) blocks it, and every `path-containment` / `path-normalization` / `pi-infrastructure-read` / `canonicalize-path` / `rule.ts` / `subagent-context.ts` leaf takes an injected `platform` parameter (the `path-utils.ts` grab-bag was dissolved into those focused modules in #505).
   To test Windows behavior on a POSIX CI, inject a `win32` `PathNormalizer` (or pass `platform: "win32"`) — never `vi.mock("node:path")`.
5. When a report claims a path/permission **bypass** (or that a rule is evadable), reproduce the literal repro against the running extension before concluding it is already handled — a live deny is stronger evidence than unit tests and can surface adjacent bugs (#493's bypass claim was already fixed, but the live repro exposed a misleading prompt, filed as #507).

The gate fails closed (#452).
Every `tool_call` goes through `createFailClosedToolCall` (`src/handlers/tool-call-boundary.ts`), the only `pi.on("tool_call")` target and the sole place an internal `GateOutcome` is translated to the SDK result shape.
A thrown gate is blocked (not allowed) and recorded as a `permission_request.blocked` review entry with `resolution: "gate_error"` — the SDK's `emitToolCall` does not catch a throwing handler, so this boundary must absorb it.
An unparseable bash command (a non-empty command that parses to zero command units) resolves to `ask` with the `<unparseable-bash-command>` sentinel `matchedPattern`, instead of falling through to a permissive top-level `*`.
An opaque-payload wrapper (`bash`/`sh`/`dash`/`zsh`/`ksh -c`, or `eval`) is flagged `opaque` by the command enumerator and floored from `allow` to `ask` with the sibling `<opaque-bash-wrapper>` sentinel — so `bash -c "…"` prompts even under a permissive `bash *: allow` (an explicit `deny` still wins).
The enumerator also strips a leading `variable_assignment` prefix from each command unit so an env-var prefix (`AWS_PROFILE=prod aws …`) cannot defeat a command-pattern rule (#481).
With `debugLog` on, the boundary writes one `permission.decision` trace per call and a `permission.session_summary` line on shutdown (via `DecisionAudit`); a `toolCalls != allowed + blocked + errors` mismatch logs a warning — a re-opened silent path.

## Notes for Agents

Before implementing, understand:

1. The problem being solved.
2. Which permission surface is involved (tools / bash / mcp / skills / special / external_directory).
3. The merge precedence between global, project, and per-agent policies.
4. Whether the change renames the `/permission-system` slash command — if yes, it is breaking.
5. The need to keep schema, example config, loader, and docs aligned.

Do not assume "allow" is a safe default.
Do not add a permission surface without also adding a policy field, schema entry, and example.

When writing documentation that claims this extension lacks a feature, verify by searching `src/`, `docs/retro/`, and closed issues.

When planning a refactoring that targets testability, read the test files alongside the production code.

When planning a refactoring that touches handler wiring or shared interfaces, load the `design-review` skill to audit for structural smells before writing the plan.

The bash `external_directory` gate only sees tokens that `classifyTokenAsPathCandidate` accepts — absolute (`/…`), home-relative (`~/…`), parent-traversal (`..`), and Windows drive-letter absolute paths (`C:/…` or `C:\…`).
A plain `./relative` token (e.g. `cat ./link/hosts`) is dropped before that gate and is instead gated by the broader `path` surface (`classifyTokenAsRuleCandidate`).
The broader classifier also recognizes the backslash drive form (`D:\…`) — the forward-slash form is caught by `includes("/")`.
On POSIX, a drive-shaped token (`C:/foo`) resolves as the real in-CWD path `./C:/foo` and remains gated by the `path` surface; the `PathNormalizer`'s `isAbsolute` decides platform-correct routing.
A bare filename (`cat id_rsa`), which has none of the broad classifier's accepted shapes, is nonetheless promoted into the `path` surface when it matches an active, specific (non-`*`) `path` deny/ask rule ([#509]) — rule-driven promotion via `classifyPromotedRuleCandidate`, decided by `PermissionManager.getPromotablePathTokenMatcher` (owns the ruleset filter and the Windows case/separator fold) and threaded into `BashPathResolver` as an injected predicate.
A bare token that matches no specific `path` rule, or any config without `path` rules at all, is still dropped exactly as before — promotion never fires against the universal `"*"` fallback.
When a plan or test asserts a specific bash repro string, trace the token through the classifier first — an issue's headline repro can describe a symptom whose literal input never reaches the gate being changed.

[#261]: https://github.com/gotgenes/pi-packages/issues/261
[#296]: https://github.com/gotgenes/pi-packages/issues/296
[#509]: https://github.com/gotgenes/pi-packages/issues/509
[ADR-0002]: https://github.com/gotgenes/pi-packages/blob/main/packages/pi-subagents/docs/decisions/0002-extensions-on-a-minimal-core.md
