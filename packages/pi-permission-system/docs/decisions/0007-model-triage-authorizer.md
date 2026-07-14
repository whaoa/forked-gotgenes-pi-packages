---
status: accepted
date: 2026-07-14
---

# 0007 — Case-by-case model judge: a deny-preserving `ModelTriageAuthorizer` decorator

## Status

Accepted.
This decision settles the design of a case-by-case model judge ([#472]); it does not implement it.
[#472] stays open, tracking the implementation, and carries this ADR.

## Context

`yoloMode` is the only non-static path in the permission decision today: a single boolean that rewrites every `ask` rule to `allow` at composition time (`rewriteAsksToYolo`, `origin: "yolo"`), suppressing prompts while preserving hard denies.
It is all-or-nothing — it cannot approve one clearly safe `ask` and still prompt on the rest.

[#472] asks for a case-by-case judge: a small model (e.g. Claude Haiku) that, at decision time, dismisses the asks it is confident are false positives and escalates the rest.
The judge was deferred by name in Phases 9 and 10; the repeat-deferral rule requires an explicit decision this phase.
The design is already settled in the architecture doc's [Discriminating delegation](../architecture/architecture.md#discriminating-delegation-a-model-authorizer) section — the `Authorizer` spine shipped in Phase 9 is the extension point it documents.
What stands between "designed" and "schedulable" is committing the open parameters to a decision record.

The enabling insight is that nothing constrains an `Authorizer` to be deterministic.
`LocalUserAuthorizer` is already a non-deterministic oracle — the human — and the determinism principle governs *recorded* authority (`evaluate()`), never the live-authority layer (ADR 0005, `docs/decisions/0005-serving-authorizer-provenance.md`).
A model can hold the `Authorizer` role on the same terms: it is live authority, so it never touches `evaluate()` or the deterministic core.

## Decision

Build the judge as a `ModelTriageAuthorizer(inner)` decorator over the existing one-method `Authorizer` interface (`src/authority/authorizer.ts`), with the following settled parameters.

### 1. Ask-only decision surface

The judge sees only `ask`.
Denies are decided by recorded authority (`evaluate()`) and structurally never reach an `Authorizer`, so the model *cannot* grant a hard deny.
The safeguard for a sensitive resource stays an explicit `deny` rule, which survives the model exactly as it survives the yolo rewrite.
Where yolo rewrites every `ask` to `allow`, the model resolves only the asks it is confident about and escalates the rest — a discriminating, deny-preserving yolo, a middle rung between prompt-everything and allow-everything.

### 2. Decorator shape, not a fourth channel

`ModelTriageAuthorizer(inner)` wraps whichever `Authorizer` `selectAuthorizer` produced (`LocalUserAuthorizer` / `ParentAuthorizer` / `DenyingAuthorizer`) and implements the same one-method interface:

```text
ask -> ModelTriageAuthorizer(inner)
         ├─ model rules "allow"          -> auto-permit (false positive dismissed)
         └─ model escalates / uncertain  -> inner.authorize(...)  // human, Parent, or Denying
```

This is the recursion "a node's `Authorizer` is its own parent," with the model's parent being `inner`.
It composes over the three-way `hasUI` / `isSubagent` / deny dispatch without knowing which arm was selected.

### 3. Fail-closed delegation

Model unreachable, timeout, or low confidence delegates to `inner`, never an auto-allow.
Under a headless `DenyingAuthorizer` inner, an uncertain model verdict therefore denies — the fail-safe direction.
The model can only ever *narrow* the set of asks that reach `inner`; it can never widen what `inner` itself would refuse.

### 4. Audit tagging

A model grant is distinguished in the review log as `origin: "authorizer:model"`, carrying the model version and the structured intent, mirroring how yolo grants carry `origin: "yolo"`.
This keeps the review log honest: a reviewer can tell a model-dismissed ask from a human, policy, or yolo allow.

The mechanism is an implementation detail deferred to [#472].
Unlike yolo — whose `ask`→`allow` rewrite produces a real `Rule` with `RuleOrigin: "yolo"` — a model grant is non-persistent (decision 5), so it does not necessarily become a `Rule`.
The `"authorizer:model"` tag may therefore ride the review-log entry / decision source rather than the `RuleOrigin` enum.
This ADR settles the *decision* (model grants are audited and distinguishable); the exact carrier is [#472]'s.

### 5. Non-persistence — live-only

A model verdict stays live-only; it does *not* silently become recorded authority.
Unlike a human's "for this session" ruling — which records a `session` rule the resolver and gate runner then read — a probabilistic judgment never hardens into durable config.
The model re-judges each identical ask; a wrong dismissal cannot silently accrete into a standing grant.

### 6. Bounded delegation, ruleset-expressible

Which surfaces the model may auto-allow is itself expressed as ruleset config — the same config the rest of the policy lives in — honoring the package principle "prefer config patterns over new runtime mechanisms." `external_directory` and secret-shaped `path` rules are excluded from delegation so they always reach the human, regardless of model confidence.

### Relationship to `evaluate()` and rule-driven promotion

The model judge sits on the ask-*consuming* side of the boundary, distinct from the ask-*producing* side (`evaluate()` and rule-driven promotion, [#509]).
Rule-driven promotion produces the `ask` for a bare filename that matches a `path` rule and deliberately accepts a fail-safe false positive (`git grep id_rsa` prompts); that false positive lives on the producing side of `evaluate()`.
`ModelTriageAuthorizer` dismisses it on the consuming side without hard-coding per-command file-argument tables.
This is the principled successor to the per-command argument-position work deferred from [#509].
The two compose cleanly: a promoted token emits the same structured descriptor a prefixed path does, so the `Authorizer` needs no promotion-specific knowledge.

## Consequences

- [#472] carries a linked, settled ADR and becomes schedulable in a future phase on its own merits.
- The judge, when built, is a `feat:` — additive, off by default, gated behind config; enabling it never loosens a `deny` and never widens what a headless inner refuses.
- The review log gains a fourth grant provenance (`authorizer:model`) alongside human, policy, and yolo, keeping model-dismissed asks auditable.
- No code, config, schema, or default changes in this documentation step.

### Rejected alternatives

- **A distinct fourth `Authorizer` selection channel** alongside the three-way `hasUI` / `isSubagent` / deny dispatch.
  Rejected: it duplicates the escalation wiring the decorator gets for free, and it would have to re-derive which inner authority applies — exactly what `selectAuthorizer` already owns.
- **Persist model grants quarantined for later human review.**
  Rejected for this ADR as added machinery with no present consumer.
  Live-only is the simpler fail-safe default; a quarantine store can be a named future extension if a review workflow ever wants it.
- **Let the model see `allow`/`deny`, not just `ask`.**
  Rejected: a model that could override a `deny` breaks the deny-preserving boundary that yolo already respects and that makes an explicit `deny` a reliable safeguard.
  Denies are recorded authority and structurally never reach an `Authorizer`.

### Accepted limitations

- **Open implementation parameters.**
  Model provider, prompt, confidence threshold, and timeout duration are deliberately left to [#472] — they are tuning, not architecture.
- **Audit-tag carrier unsettled.**
  Whether `"authorizer:model"` lands as a `RuleOrigin` member or a distinct review-log field is [#472]'s to decide; this ADR fixes only that the grant is audited and distinguishable.
- **A distinct, more distant direction is out of scope.**
  A model that *classifies* access intent **before** `evaluate()` (feeding recorded authority) is a different seam from this Authorizer (which holds live authority and answers the `ask`).
  It weakens the "same `(toolName, input)` yields the same ruling" property more subtly and warrants its own decision record — see the architecture doc's "Beyond the target: a non-deterministic access-intent classifier."

[#472]: https://github.com/gotgenes/pi-packages/issues/472
[#509]: https://github.com/gotgenes/pi-packages/issues/509
