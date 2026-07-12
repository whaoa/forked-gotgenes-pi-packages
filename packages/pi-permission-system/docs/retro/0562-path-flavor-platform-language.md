---
issue: 562
issue_title: "Leaf path modules re-derive the win32 path flavor from a raw platform parameter"
---

# Retro: #562 — Leaf path modules re-derive the win32 path flavor from a raw platform parameter

## Stage: Planning (2026-07-10T00:00:00Z)

### Session summary

Planned Phase 10 Step 3: introduce `PathFlavor`, the resolved product of the single `platform === "win32"` decision, and thread it into the path leaves in place of the raw `platform` string.
The design deepened well past the issue's original "value object with a fold" framing through operator questioning: `PathFlavor` became a **behavioral collaborator** — the platform's path *language* (syntax `hasPathSeparator`, semantics `bashTokenShape`, equivalence `fold`/`comparable`/`isWithin`/`matchOptions`) — injected once from `index.ts`, dissolving `PathNormalizer`'s two `!== "win32"` guards and removing `NodeJS.Platform` from every domain signature.
Plan committed with a 10-step bottom-up lift-and-shift TDD order; follow-up [#571] filed for the deferred subagent-containment unification.

### Observations

- The operator explicitly pushed scope wider than the issue: three rounds of `ask_user` converged on (a) behavioral over data-bag, (b) tell-don't-ask (`hasPathSeparator` replacing the leaked `usesWindowsSeparators()` accessor read by `bash-path-resolver`), and (c) threaded construction from the composition root over internal construction.
- Zoom-out finding: every platform-conditional in the package factors into exactly three capability groups (syntax / semantics / equivalence), which is what justifies one cohesive `PathFlavor` object rather than a config bag.
- Two genuine findings surfaced during the full platform-shaped sweep: a second divergent containment algorithm in `subagent-context` (`isPathWithinDirectoryForSubagent`, the same must-agree smell — deferred to [#571] because unifying it is behavior-affecting), and the `BashDialect` axis (kept as one object because pi core fixes the win32⇔Git-Bash pairing — track-and-watch).
- Decided `impl: PlatformPath` is exposed, not wrapped — its post-migration consumers are all path-domain primitives and `PlatformPath` is Node's own strategy; wrapping would be pure ceremony.
  Sealable later in two lines.
- `permission-manager.ts` can consume `PathFlavor` without violating ADR-0002 — the `no-restricted-imports` guard bans only `access-intent/access-path`, and `PathFlavor` is a plain value object in `src/path/`.
- Verified the whole change is behavior-preserving, so every implementation commit is `refactor:` (hidden changelog type) — the roadmap's `Release: independent` means it lands on `main` and auto-batches, not that it cuts its own release (Refs [#479]).
- Lift-and-shift bridge is safe: `pathFlavorForPlatform` returns cached singletons, so the transitional inline `pathFlavorForPlatform(platform)` at not-yet-migrated call sites cannot diverge and stays bypass-safe until step 8 removes it.

[#479]: https://github.com/gotgenes/pi-packages/issues/479
[#571]: https://github.com/gotgenes/pi-packages/issues/571
