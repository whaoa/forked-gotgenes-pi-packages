---
issue: 592
issue_title: "TSC Error when importing publicly available types from the package"
---

# Retro: #592 — TSC Error when importing publicly available types from the package

## Stage: Planning (2026-06-24T00:00:00Z)

### Session summary

Diagnosed the reported `TS2307` as a Node subpath-imports resolution failure: the published `exports` points at raw `./src/service.ts`, whose transitive `#src/*` imports map to `./src/*` (no extension), and subpath-imports resolution — unlike TypeScript `paths` — does not probe extensions.
Confirmed the sibling `pi-subagents` already solved the identical problem with a `rollup-plugin-dts` bundled `dist/public.d.ts` behind an `exports.types` condition, guarded by a `verify:public-types` CI check.
Produced a build-plan-style plan that adopts that convention verbatim for this package's single `.` entry.

### Observations

- Third-party issue (author `enolive`, not the operator), so the direction gate ran even though the reporter's proposed fix was concrete.
  The reporter's one-line fix — appending `.ts` to the `imports` map — is deliberately **not** taken.
- Operator answers walked the decision: first toward the bundled `dist` artifact plus a dogfood guard, then relaxed to "recommend the robust, `pi-subagents`-consistent approach."
  Final direction: fully consistent with `pi-subagents` — bundled declarations + `verify:public-types` guard, and **no** `imports`/`paths` dogfood (which would diverge from the sibling's config shape).
  The `verify:public-types` guard is stronger than the internal dogfood for this bug class because it type-checks the real packaged tarball from an external consumer.
- Verified the public surface is plain TS (`z.infer` types resolve structurally; `permission-events.ts` has no imports), so `external: [/^@earendil-works\//]` suffices and the emitted `.d.ts` inlines with no `zod`/pi-sdk leakage.
- Verified no workspace package imports `@gotgenes/pi-permission-system` as a type dependency, so `pnpm -r run check` never needs `dist/` prebuilt.
- Not breaking: the runtime `default` condition still resolves to `src/service.ts`, so jiti loading is unchanged; only type resolution gains the bundle.
  Ship independently (`fix:` cuts the release; surrounding `build:`/`test:`/`docs:` commits batch in).
- Late scope addition (operator): lift `rollup` + `rollup-plugin-dts` into the `pnpm-workspace.yaml` catalog now that a second package uses them, and update to the latest versions.
  Plan revised to catalog `rollup ^4.62.2` (bumped from the `^4.61.1` pinned in `pi-subagents`) and `rollup-plugin-dts ^6.4.1`, migrate `pi-subagents`' two pins to `catalog:`, and add both as `catalog:` devDeps here.
  The bump moves `pi-subagents` within `rollup@4.x`, so step 1 re-verifies its `verify:public-types` + tests.
  This is the only touch to a second package (a specifier-only swap), so the plan stays single-package under `pi-permission-system`.
- Next step is `/build-plan` (no new Vitest red→green cycles; the regression guard is a shell script mirroring the sibling).
