---
issue: 511
issue_title: "pi-permission-system: retire the residual getPlatform() threading (infra-read + skill-prompt sanitization)"
---

# Retro: #511 — Retire the residual `getPlatform()` threading (infra-read + skill-prompt sanitization)

## Stage: Planning (2026-06-28T23:10:40Z)

### Session summary

Produced a numbered plan to route the two residual `platform`-threading sites (external-directory infra-read and skill-prompt sanitization) through the session's `PathNormalizer`, adding two methods (`comparableValue`, `isInfrastructureRead`) and dropping the `platform` parameters from `describeExternalDirectoryGate`, `describeSkillReadGate`, and the skill-sanitizer functions.
Filed follow-up #513 for the final `getPlatform()` removal, which neither #511 nor #502 can complete alone (the pipeline reads `getPlatform()` once and threads it to three gates; the tool gate keeps it until #502 lands).

### Observations

- The issue raises a genuine fork for skill sanitization (carry `AccessPath`s vs. resolve through the normalizer).
  Resolved decisively against carrying `AccessPath`s: `AccessPath.forPath` eagerly computes the canonical alias via `realpathSync` (`canonicalize-path.ts`), so it would add per-entry, per-turn filesystem access and shift lexical matching toward canonical — both behavior changes against a behavior-preserving refactor.
  Chose a lexical `comparableValue` method instead.
  Did not invoke `ask_user` because the behavior-preservation invariant removes the real choice (one option violates it).
- Confirmed `tcc.cwd === ctx.cwd === normalizer.cwd` (set in `permission-gate-handler.ts` and rebuilt on `session.activate`), which is what makes moving the `cwd` argument onto the baked normalizer behavior-preserving.
- `isInfrastructureRead` takes the already-built `AccessPath` (not a raw path) so the gate does not re-run `forPath`/`realpathSync` — Tell-Don't-Ask plus no double FS.
- Steps 1–4 of Phase 7 (#502–#505) are all still OPEN, so this plan deliberately leaves `getPlatform()` in place rather than removing it; the dependency, not ambiguity, forces that.
- `getPlatform()` removal depends only on #511 + #502 (the only two `getPlatform()` readers are `before-agent-start.ts` and the pipeline; the pipeline's read survives for the tool gate until #502).
  It does not depend on #503/#504, which touch `input-normalizer.ts` (that file gets `platform` elsewhere, not via `getPlatform()`).
- Doc surface to update: `architecture.md` (normalizer method list + the residual-threading subsection) and the package `SKILL.md` (normalizer method list in Debugging).
  Plans/retros under `docs/` are historical and left untouched.
