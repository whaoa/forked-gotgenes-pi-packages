---
issue: 526
issue_title: "pi-permission-system: move yolo into recorded authority (composition-stage ask→allow rewrite)"
---

# Retro: #526 — Move yolo into recorded authority (composition-stage ask→allow rewrite)

## Stage: Planning (2026-07-05T00:00:00Z)

### Session summary

Planned Phase 8 Step 2: relocate yolo mode from the prompt path into a composition-stage `ask`→`allow` rewrite over the composed ruleset, tagged `origin: "yolo"`.
The rewrite lands in `PermissionManager.check` (post-cache, behind an injected `() => boolean` reader), with `deriveResolution` + a `GateRunner` yolo fast-path preserving `auto_approved` review-log/decision-event parity.
Produced a 4-step TDD plan (rule helper → manager rewrite + wiring → resolution/runner → docs) and a retro breadcrumb.

### Observations

- **Post-cache, not cache-key.**
  The `resolvedPermissionsCache` is keyed by `agentName` + loader stamp only.
  Applying the rewrite inside `check()` over `fullRules` (rather than in `resolvePermissions`) keeps `getComposedConfigRules`/`getToolPermission` yolo-free, satisfying the display-unchanged goal without touching the cache key.
  The synthesized universal `*/*` default is part of `composedRules`, so an unmatched surface is covered automatically.
- **Single runner choke point.**
  Both `ToolCallGatePipeline` and `SkillInputGatePipeline` route through `GateRunner.run`, so one yolo fast-path (`check.origin === "yolo"`) covers all gated surfaces.
  Mirrors the existing session-hit fast-path.
- **Prompter-arm reachability verified.**
  Traced every `ask`-producing path: tool/bash/mcp/path/external_directory and skill-input all resolve via `manager.check` (yolo-rewritten); the skill-read `preResolved` state comes from the yolo-aware skill sanitizer, so it is already `allow` under yolo.
  No `ask` reaches the prompter under yolo — confirming [#527] can safely delete the arm.
- **Two observable-output forks surfaced to the operator via `ask_user`.** (1) Review-log entry shape — chose the runner's `logContext` convention (`toolCallId`, not `requestId`) over reconstructing the prompter's exact fields. (2) Skill-read under yolo — accepted `policy_allow`/`origin: "builtin"` (the sanitizer already resolves it to allow) rather than threading `origin: "yolo"` through the `SkillPromptEntry` → `preResolved` chain.
- **Batch tail deferral.**
  Batch "yolo-recorded-authority" (Steps 2, 3; tail = [#527]).
  Plan marker is `mid-batch — defer`; the release-please PR stays open until [#527] lands.
- **Doc-sync traps noted.**
  The architecture doc inline-copies `RuleOrigin`/`Rule` (must add `"yolo"`); the "yolo checks on the ask path" health-metric row is *not* flipped in this step (arms removed only in [#527]); `permission-prompter.md` update rides with [#527] since the arm still exists.
  No `README.md` command-surface change.
- **ADR-0002 boundary preserved.** `rewriteAsksToYolo` is a string-only `Ruleset` transform in `rule.ts`; the manager imports it without breaching the `no-restricted-imports` `AccessPath` guard.

## Stage: Implementation — TDD (2026-07-05T15:45:00Z)

### Session summary

Executed all 4 planned TDD cycles for the yolo composition-stage rewrite: (1) `rewriteAsksToYolo` + `"yolo"` `RuleOrigin` in `rule.ts`; (2) the post-cache rewrite in `PermissionManager.check` behind an injected `isYoloEnabled` reader, wired in `index.ts`; (3) `deriveResolution` allow+autoApproved→`auto_approved` plus a `GateRunner` yolo fast-path; (4) architecture-doc sync (inline `RuleOrigin` listing, Step 2 ✅ on heading + `S2` Mermaid node, `Landed:` note).
Test count moved +16 (2283 → 2299); full suite, `pnpm run check`, root `pnpm run lint`, and `pnpm fallow dead-code` all green.

### Observations

- **Plan deviation (simplification).**
  The plan suggested threading `isYoloEnabled` through `test/helpers/manager-harness.ts`; instead the new `test/permission-manager-yolo.test.ts` constructs `PermissionManager` directly with the already-exported `createInMemoryPolicyLoader` + an injected `isYoloEnabled` closure.
  Narrower, no harness surface added.
  The reviewer confirmed this is a clean simplification, not a gap.
- **Lint caught unnecessary optional chains in the first Red.**
  `@typescript-eslint/no-unnecessary-condition` fired on `rewritten?.` after a `const [rewritten] = ...` destructure (element type is non-nullish with `noUncheckedIndexedAccess` off); array-index `result[0]?.` was *not* flagged.
  Fixed the destructured accesses to plain member access before committing.
- **Pre-completion reviewer: PASS** — ready for `/ship-issue`.
  Deterministic checks green; cross-step invariants (#478 single `check` entry point, #506/ADR-0002 string boundary, #525 manager-harness fixtures, display-unchanged) all verified.
  `mmdc` rendered the modified `architecture.md` charts including the `S2` ✅ node.
  No WARN findings.
- **Ship-time note.**
  Release is **mid-batch — defer** (batch "yolo-recorded-authority", tail = [#527]); the release-please PR stays open until [#527] lands.
  Confirm at ship time.
- **Skill-read parity nuance held as designed.**
  No code path change was needed for skill-reads: the yolo-aware sanitizer already resolves a skill's state to `allow` before the gate, so a skill-read auto-allows and logs `policy_allow`/`origin: "builtin"` (accepted, operator-confirmed).
