---
issue: 547
issue_title: "Include a JSON Schema definition in pi-permissions.jsonc for completions and easier configuration"
---

# Retro: #547 — Include a JSON Schema definition in pi-permissions.jsonc for completions and easier configuration

## Stage: Planning (2026-07-06T00:00:00Z)

### Session summary

Planned issue #547 (third-party, filed by `JasonLandbridge`).
Discovered the requested JSON Schema already exists (`schemas/permissions.schema.json`), the config already accepts `$schema`, and completions technically already work — the real defects are a stale hosted URL (points at the pre-monorepo `gotgenes/pi-permission-system` fork) and a hand-maintained schema that drifts from the TS types and hand-rolled loader guards.
Through three `ask_user` rounds the operator chose the "Full" direction: adopt **zod** (pin `4.4.3`, the production `latest`) as the single source of truth, derive the Draft 2020-12 JSON Schema from it, and route the loader's runtime validation through it with **strict, breaking** semantics (reject a malformed field with a clear description, fail-closed to `ask`).
Wrote a 6-step lift-and-shift TDD plan and committed it.

### Observations

- Third-party issue → did not skip the `ask_user` gate; the operator materially reshaped scope (zod over the issue's TypeBox suggestion; runtime validation, not schema-only; stricter/breaking with clear errors).
- The operator interjected two directives mid-plan: use the current production zod (`4.4.3`, confirmed via `pnpm view`, since the `npm` shim is blocked) and lean on schema composability without over-abstraction — folded both into the design (bottom-up composable schemas mirroring the existing `$defs`, `reused: "ref"`).
- Key design guards captured: **no `.default()` in the parse schema** (defaults belong post-merge in `normalizePermissionSystemConfig`, else global/project override semantics break); allow `$schema` explicitly under `strictObject`; **fail-closed to `ask`** on reject is the security-critical invariant and gets its own test.
- `markdownDescription` is not confirmed to auto-copy from `z.toJSONSchema` ([colinhacks/zod#5272] is open) — the Step 2 parity test decides whether `.meta()` suffices or the `override` callback is needed.
- Scope interaction with open roadmap Step 8 ([#532]): #547 removes the two config-only guards (`normalizeOptionalStringArray`, `normalizeOptionalPositiveInt`) that #532 meant to keep, and keeps the domain guards #532 meant to move — noted as a Non-Goal, updating `architecture.md` line 807/906 rather than completing #532.
- No follow-up issues filed: deeper `normalize.ts`/`policy-loader.ts` guard cleanup is deferred to existing #532; per-agent frontmatter validation left as an Open Question (not speculative-filed).
- Release: ship independently — #547 is not in the architecture roadmap.
- Freshness gate is a vitest parity test (runs in the existing `pnpm -r run test` CI job), so no `ci.yml` edit is needed.

## Stage: Implementation — TDD (2026-07-06T17:26:46Z)

### Session summary

Implemented all 6 planned TDD steps across 6 commits: added the composable zod schema module (`config-schema.ts`) as the single source of truth, generated `permissions.schema.json` from it (fixing the stale `$id` URL), routed the config-file loader through strict `safeParse` (breaking, fail-closed), removed the two superseded config-only guards, derived the config types from zod, and updated docs/ADR/migration/skill.
Package tests went 2283 → 2293 (+10 net: +22 from `config-schema.test.ts`, +1 fail-closed test, −13 from removed guard tests).
All deterministic gates pass; pre-completion reviewer returned WARN (one finding, fixed).

### Observations

- **Two unplanned but necessary deviations, both honoring the plan's scope.**
  (1) `normalizeUnifiedConfig` turned out to be dual-purpose — it also validated per-agent `.md` frontmatter (which carries non-config keys like `name`/`model`).
  A strict `strictObject` would have rejected those and silently dropped agent permission blocks.
  Fix: `policy-loader.ts` now extracts only the `permission` block via the exported tolerant `normalizeFlatPermissionValue`, so config files are strict while agent frontmatter stays tolerant (the plan's stated boundary). (2) Legacy-file validation issues are suppressed in `loadAndMergeConfigs` so the move-it migration message stays the clean, actionable signal.
- **The generated schema is not byte-identical to the hand-maintained one** — zod emits `anyOf`-of-consts (not `oneOf`) and adds a safe-int `maximum` on integers.
  Functionally equivalent for editors; the parity test snapshots the generator output for freshness rather than matching the old file.
  `markdownDescription`, `examples`, `default`, and per-value descriptions all survive via `.meta()` (no `override` callback needed).
- **`gen:schema` chains `biome format`** because `JSON.stringify(…, null, 2)` collapses differently than biome (single-element arrays); chaining keeps the committed file deterministic and lint-clean.
- **No `.default()` in the parse schema** — defaults stay in `normalizePermissionSystemConfig` post-merge, preserving global-vs-project override semantics (a plan guard that held up).
- **Type derivation was safe** — `expectTypeOf(...).toEqualTypeOf(...)` in `config-schema.test.ts` (enforced by `tsc`, since tsconfig includes `test`) proved the `z.infer` types equal the hand-written ones before the lift-and-shift, so all ~58 consumers compiled untouched.
- **Pre-completion reviewer: WARN** — the only finding was a missing README Documentation-table row for the new `docs/migration/strict-config-validation.md`; added it (amended into the docs commit) and re-verified lint.
  Everything else PASS, including explicit tests for the fail-closed `ask` fallback and legacy-file suppression.
- **#532 interaction** — removed the two config-only guards it planned to keep; updated `architecture.md`'s Step 8 note and the ADR to reflect the shrunk target without closing #532.
- **zod `4.4.3`** installed cleanly, no `minimumReleaseAgeExclude` needed; tarball verified to ship `src/config-schema.ts` + schema + migration doc and exclude `scripts/`, `test/`, and the internal ADR.

[#532]: https://github.com/gotgenes/pi-packages/issues/532
[colinhacks/zod#5272]: https://github.com/colinhacks/zod/issues/5272
