---
issue: 581
issue_title: "pi-permission-system: decision record for the case-by-case model judge (ModelTriageAuthorizer)"
---

# Retro: #581 — decision record for the case-by-case model judge (ModelTriageAuthorizer)

## Stage: Planning (2026-07-14T00:00:00Z)

### Session summary

Planned Phase 11 Step 7: a documentation-only ADR (`docs/decisions/0007-model-triage-authorizer.md`) recording the six settled `ModelTriageAuthorizer` parameters (ask-only surface, decorator shape, fail-closed delegation, `origin: "authorizer:model"` audit tagging, live-only non-persistence, ruleset-expressible bounded delegation).
The design was already fully settled in the architecture doc's `Discriminating delegation` section; the plan transcribes it into an ADR, marks Step 7 complete, and leaves [#472] open with a linked ADR.
Next stage is `/build-plan` (no test cycles).

### Observations

- Authored by the operator (`gotgenes`) and unambiguous (settled architecture-doc design), so the `ask-user` gate was skipped.
- One genuine design choice existed — non-persistence as live-only vs. quarantined-for-review.
  Settled as **live-only** (matching the architecture doc's stated preference; quarantine is parenthetical there), with quarantine recorded as a rejected-for-now alternative and a named future extension.
- Flagged an implementation seam deferred to [#472]: a model grant is non-persistent, so `origin: "authorizer:model"` may ride the review-log entry rather than the `RuleOrigin` enum (unlike `"yolo"`, which becomes a real `Rule`).
  The ADR settles the *decision* (audited + distinguishable); the mechanism is [#472]'s.
- `Release: independent` per the roadmap — docs-only `docs:` commits, no batch, cuts no release on its own.
- Grep confirmed `ModelTriageAuthorizer` appears only in `architecture.md` — no `src/`/`test/`/README surface references the not-yet-built symbol, so no code or user-doc edits are in scope.
- Build stage must mark Step 7 `✅` on both the heading and the `S7` Mermaid node, and link the ADR from the `Discriminating delegation` section, in the implementation commit (not deferred to ship).
