---
issue: 475
issue_title: "pi-permission-system: extract command enumeration and cwd projection; relocate the bash sub-domain (Phase 6 Step 3)"
---

# Retro: #475 — Extract command enumeration and cwd projection; relocate the bash sub-domain

## Stage: Planning (2026-06-25T13:35:00Z)

### Session summary

Produced a four-cycle plan for Phase 6 Step 3 (the `bash-program-decomposition` batch tail): extract command enumeration to `command-enumeration.ts`, the `cd`-fold projection to `cwd-projection.ts`, relocate the slimmed `BashProgram` to `access-intent/bash/program.ts`, and relocate `bash-token-classification.ts` to `access-intent/bash/token-classification.ts`, repointing all gate consumers and tests.
The plan embeds four rendered-and-validated Mermaid diagrams: a shared data-flow view plus three module-layout variants (A/B/C) for the facade-scope decision, written at the operator's request so they can render them in a browser before choosing.

### Observations

- The one genuine design fork is **facade thinness / `EffectiveBase` encapsulation**, surfaced via `ask_user` (operator's own issue, so the gate confirmed a real design choice rather than direction): A = strict lift-and-shift (facade keeps `externalPaths`/`pathRuleCandidates`, reads `EffectiveBase` internals across the new boundary); B = thin facade (projection moves to `cwd-projection.ts`, `EffectiveBase` fully encapsulated); C = A plus a `resolveCandidateBase()` helper.
- The operator inclined toward B but asked for the data flow and a comparison diagram before committing, then asked for the plan to be written "as is" with the diagrams embedded for browser rendering.
  Plan recommends B and is written for B, with A/C deltas noted inline; the decision is flagged **pending visual review** — the one gate before TDD.
- Corrected the operator's initial framing of B: B's win is **cohesion/encapsulation** (one module owns the `cd`-projection lifecycle end to end; `EffectiveBase` never crosses a boundary), not new test surface.
  The projection functions' natural input is parse output, so existing parse-driven tests stay as facade coverage rather than converting to isolated unit tests.
- `BashCommand` moves to `command-enumeration.ts` (its producer); only `bash-command.ts` imports it externally. `BashPathRuleCandidate` has no external importer (public return type only), so under B it co-locates with `cwd-projection.ts`.
- Mermaid pitfall hit during validation: `class` and `enum` are reserved flowchart node ids (`Expecting 'SPACE', got 'SQS'`); renamed to `clsf` / `enm`.
  All four diagrams validated with `mmdc`; `rumdl` clean.
- Batch-tail release caveat recorded: all three steps are `refactor:`, so release-please derives no version bump from them — "ship now" means "nothing holds the batch back," not "force a release."
  Folded in the [#474]-deferred architecture `Outcome:` fix ("≤ 670 LOC" vs actual 695).
- No follow-up issues filed: Step 4 ([#476], `AccessPath`) already exists; the external-directory gate collapse is tracked as Phase 6 Step 5.

[#474]: https://github.com/gotgenes/pi-packages/issues/474
[#476]: https://github.com/gotgenes/pi-packages/issues/476
