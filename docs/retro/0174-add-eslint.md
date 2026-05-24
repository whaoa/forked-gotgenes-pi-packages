---
issue: 174
issue_title: "Add ESLint for type-aware lint rules and import path enforcement"
---

# Retro: #174 — Add ESLint for type-aware lint rules and import path enforcement

## Stage: Planning (2026-05-23T20:00:00Z)

### Session summary

Produced a 6-step build plan for adding ESLint alongside Biome across all six packages.
The plan uses `typescript-eslint` type-aware presets with cherry-picked `strictTypeChecked` rules matching the RepOne cdk config, plus a custom inline ESLint rule for import path enforcement with auto-fix support.

### Observations

- **No third-party import plugins:** Both `eslint-plugin-no-relative-import-paths` and `eslint-plugin-paths` use legacy CommonJS config, deprecated ESLint APIs, and lack flat config support.
  A custom inline rule (~50 lines) is simpler, safer, and supports auto-fix tailored to the monorepo's uniform `#src/*` / `#test/*` convention.
- **Biome overlap avoidance:** Plan specifies using `*TypeCheckedOnly` presets if available in the flat config API, falling back to full presets with overlapping rules disabled.
  This keeps ESLint focused on what Biome can't do.
- **Existing violations are manageable:** 46 relative imports in `src/` + 5 in `test/`, ~27 `any` usages in source (mostly `pi-subagents` SDK boundary code needing `eslint-disable` comments).
- **`pi-subagents` is missing `"type": "module"`** — discovered during investigation, included as step 1.
- **This is a `/build-plan` change** (config/tooling), not a TDD change.
  The custom rule is validated by running ESLint against the codebase itself.

## Stage: Implementation — Build (2026-05-23T23:10:00Z)

### Session summary

Executed all 6 plan steps across roughly 90 source and test files.
`eslint.config.js` now enforces type-aware rules and the custom `no-parent-relative-imports` rule (with auto-fix) against all package TypeScript files.
All 6 packages have normalized `lint` scripts, the root `lint` script includes ESLint, and the `prek.toml` pre-commit hook runs `eslint --fix` on staged `.ts` files under `packages/`.

### Observations

- **`*TypeCheckedOnly` presets do exist in the flat config API** — `tseslint.configs.recommendedTypeCheckedOnly` and `stylisticTypeCheckedOnly` are available, giving clean separation from Biome with zero duplicate warnings.
- **Violation count was higher than estimated** — ~300 after dropping `js.configs.recommended`, requiring systematic file-by-file fixes across all packages.
  The bulk came from pi-subagents SDK boundary code (Pi TUI/theme types are untyped `any`), handled with file-level `eslint-disable` comments and TODO notes for upstream Pi SDK type improvements.
- **3 real bugs caught by the new rules** — floating promises in `agent-runner.ts` (`session.steer`/`session.abort` not void-wrapped), misused-promises (`onAbort` callback returning `Promise<void>` where `void` was expected), and `await-thenable` in `agent-manager.ts` (non-Promise iterable passed to `Promise.allSettled`).
- **Background agent introduced a regression** — changed `config.yoloMode === true` to `config.yoloMode` in `yolo-mode.ts`, breaking 2 tests.
  Reverted and used `Boolean(config.yoloMode)` with a targeted disable.
- **`prefer-nullish-coalescing` requires caution** — `||` → `??` is not always safe: `parentContext || undefined` in `parent-snapshot.ts` intentionally converts falsy strings to `undefined`; changing to `??` broke a test.
- **`no-invalid-void-type` with `allowInGenericTypeArguments: true` does not cover generic function calls** — `Promise.withResolvers<void>()` and `ctx.ui.custom<void>(...)` still flag even with the option enabled, requiring per-line `eslint-disable` comments.
- **CI wiring**: The root `lint` script already runs in the CI `Lint` step; adding `eslint packages/` to it is sufficient — no new CI step needed.
