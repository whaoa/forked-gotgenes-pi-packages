---
issue: 574
issue_title: "Support configurable shell-tool aliases for exec_command"
---

# Retro: #574 — Support configurable shell-tool aliases for `exec_command`

## Stage: Planning (2026-07-13T18:30:00Z)

### Session summary

Planned Phase 11 Step 3 (batch "shell-tool-aliases" tail): the enforcement gate that consumes the `shellTools` config landed in `#580`.
Produced a 5-cycle plan (`0574-gate-aliased-shell-tools-bash-stack.md`) routing an aliased shell tool (e.g. `exec_command`) through the full bash stack at parity with native `bash` — command decomposition, wrapper flooring, the `<unparseable-bash-command>` fail-closed sentinel, bash path + external-directory token gates, `bash:` rules — plus full `workdir` parity (effective resolve base + `external_directory` gating).

### Observations

- **Third-party issue, but operator-adopted.**
  `#574` was filed by `marcinkardas` (gh user is `gotgenes`), so the `ask-user` direction gate was mandatory.
  The operator confirmed **implement as roadmapped** and **full workdir parity now** — the direction was already settled by the roadmap (Step 3) and by `#580` shipping the config half explicitly for this.
  The operator drilled into two design questions before deciding (how it is configured; how `workdir` relates to cwd), so the plan front-loads a concrete config example and the workdir/cwd model.
- **Key architectural finding: `workdir` needs almost no rearchitecture.**
  `PathNormalizer` bakes the session cwd for the **containment boundary only**; the **resolve base** is threaded per-token as the walk's `EffectiveBase.offset` (how inline `cd` already works).
  So `workdir` is "an implicit leading `cd <workdir>`" — reuse the existing cd-fold machinery.
  Two contained additions in the bash parse layer: seed the walk's initial `EffectiveBase` from `workdir` (factor `deriveBaseFromCdTarget` out of `foldCd`), and add `workdir`'s own `AccessPath` to the external set when outside cwd (a real `cd /etc` flags `/etc` via its argument token; the seed has none, so add it).
  No change to containment, `AccessPath`, or the `external_directory` policy — the gate flags workdir with no signature change.
- **Single dispatch point, `classifyToolKind` left alone.**
  The alias consult is a **separate** function — `resolveShellInvocation(toolName, input, aliases) → { command, workdir } | null` in `tool-kind.ts` — because it needs config and returns a richer product than a `ToolKind`.
  Keeping `classifyToolKind` config-free preserves its ADR-0002 string boundary and its config-free presentation/manager consumers.
  Native bash routes through the same seam (`{ command: input.command, workdir: undefined }`), so the two bash gates drop their hardcoded `toolName === "bash"` / `input.command` derivations.
- **The real weight is aliasing plumbing, not workdir.**
  The bash gates and pipeline hardcode `toolName === "bash"` / `input.command` in a handful of sites; threading the resolved `ShellInvocation` through them (steps 2–3) is the bulk.
  `workdir` (step 4) is a small, reuse-heavy parse-layer seam.
- **Presentation nuance:** an aliased shell command must present on the **`bash` surface** (so a session "allow" writes a `bash:` rule and the decision value is the command) while keeping the invoked tool name (`exec_command`) in the review log — the plan threads the effective shell command/surface into `describeToolGate` / `deriveDecisionValue` / `deriveSuggestionValue`.
- **`fallow dead-code` batch trap (from `#580`):** the step-1 `resolveShellInvocation` export has no consumer until step 3.
  The plan's batch note runs the `dead-code` gate at the step-3 boundary, not step-1 — the same speculative-export class `#580`'s retro flagged.
- **Open question deferred to TDD:** whether `normalizeInput`'s bash branch needs alias-awareness depends on whether any consumer routes an aliased `(toolName, input)` through `permission-manager.checkPermission` (the enforcement path is the gate pipeline, which uses `resolveShellInvocation` directly).
  Traced in step 3; no follow-up filed pre-emptively.
- **Release:** ship now — batch tail; landing Step 3 cuts the release carrying both the deferred `#580` `feat:` and this step's `feat:` commits.
  Next step: `/tdd-plan` (this plan has test cycles).
