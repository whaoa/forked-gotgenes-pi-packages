---
issue: 398
issue_title: "Subagent stuck in a permission-asking loop"
---

# Retro: #398 — Subagent stuck in a permission-asking loop

## Stage: Planning (2026-06-13T00:00:00Z)

### Session summary

Planned the fix for the overlapping forwarded-permission cleanup race reported by third-party contributor `graelo`.
The race lets a concurrent subagent's cleanup remove the parent's `responses/` directory while another request is still pending, so the eventual response write fails with `ENOENT` and the requester loops forever.
Produced a two-step TDD plan applying both reporter-suggested fixes.

### Observations

- Third-party issue (author `graelo` ≠ operator `gotgenes`), so the direction was confirmed via the `ask_user` gate before planning.
  Operator chose fix (a)+(b) — the root-cause invariant plus defense-in-depth — over either alone.
- Fix (b): widen `tryRemoveDirectoryIfEmpty` to return a `boolean` ("gone after the call") and gate `responses/` removal on `requests/` being empty in `cleanupPermissionForwardingLocationIfEmpty`.
  The return-type widening is additive — both call sites are in the same file and no other module imports it.
- Fix (a): `ensureDirectoryExists(location.responsesDir)` guard in `processInbox` after the non-empty `requestFiles` check; the function is already exported from `io.ts`, so no upstream API gap.
- Non-breaking: no config/output/default change, so `fix:` commits, not `fix!:`.
- Test surface: `io.test.ts` currently covers only pure helpers, so the cleanup invariant gets brand-new real-tmpdir coverage; `permission-forwarder.test.ts`'s `processInbox` block already uses `mkdtempSync`, so the (a) case follows that established pattern.
- No `docs/architecture/` references to the affected functions — only the historical plan `0317` mentions them, and it is not updated.

## Stage: Implementation — TDD (2026-06-13T13:40:00Z)

### Session summary

Completed two TDD cycles implementing fixes (b) and (a).
Step 1 widened `tryRemoveDirectoryIfEmpty` to return `boolean` and gated `responses/` removal on `requests/` being gone in `cleanupPermissionForwardingLocationIfEmpty`.
Step 2 added a defensive `ensureDirectoryExists` guard in `processInbox` before processing any pending request files.
Test count: 1996 → 2003 (+7: 3 in `io.test.ts`, 1 in `permission-forwarder.test.ts`, plus 3 supporting `tryRemoveDirectoryIfEmpty` return-value cases).

### Observations

- No deviations from the plan; both steps landed exactly as described.
- The `tryRemoveDirectoryIfEmpty` return-type widening (`void → boolean`) required splitting the combined `ENOENT`/`ENOTEMPTY` guard into two separate `if` branches — each `rmdirSync` error code now returns a distinct boolean, which also makes the semantics clearer.
- `ensureDirectoryExists` was already exported from `io.ts`, so step 2 was a one-import, one-guard addition with no upstream API gap.
- The real-tmpdir test for step 2 confirmed that without the fix the `permission_forwarding.error` log fires immediately (the response write fails), then verified it is absent after the fix.
- Pre-completion reviewer: PASS — all deterministic checks green, conventional commits valid, no code-design or documentation concerns.
