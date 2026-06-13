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
