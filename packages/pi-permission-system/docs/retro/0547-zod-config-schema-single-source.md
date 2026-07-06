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

[#532]: https://github.com/gotgenes/pi-packages/issues/532
[colinhacks/zod#5272]: https://github.com/colinhacks/zod/issues/5272
