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

## Stage: Implementation — TDD (2026-07-13T18:20:00Z)

### Session summary

Implemented all five planned TDD cycles plus one preparatory refactor, landing the shell-tool aliasing enforcement: `resolveShellInvocation` dispatch point, `BashProgram` owning its source command, pipeline consumption, full `workdir` parity, and docs/roadmap.
Test count `2387 → 2418` (+31); `pnpm run check`, root `pnpm run lint`, and `pnpm fallow dead-code` all green.
Pre-completion reviewer: **WARN** (no FAILs) — both warnings addressed with fast-follow commits before shipping.

### Observations

- **Mid-implementation design pivot (operator-prompted): dropped the `command` parameter for `BashProgram.commandText()`.**
  The plan's step 2 threaded a `command` parameter into the two bash gates.
  The operator flagged that `command` is redundant state — a projection of the shell invocation that always co-travels with `bashProgram` (the parsed form of the *same* command).
  The right collaborator is `BashProgram` itself (it is constructed from the command), so it now exposes `commandText()` and the gates read it, dropping the parameter.
  Since step 2 was unpushed, I `git reset --mixed HEAD~1` to drop it and folded the mechanism into the step-3 feat.
  Net: the two bash gates kept their original `(tcc, bashProgram, resolver)` signature (no churn, native-bash regression suites unmodified), and the redundant-param smell never shipped.
- **`workdir` needed almost no rearchitecture** — as the plan predicted, `PathNormalizer` already separates the containment boundary (baked session cwd) from the resolve base (per-token walk offset), so `workdir` is "an implicit leading `cd <workdir>`": seed the walk's initial `EffectiveBase` (reusing the `deriveBaseFromCdTarget` helper the prep refactor extracted from `foldCd`) and add the workdir's own `AccessPath` to the external set when outside cwd.
  Containment stays measured against the session cwd, so a workdir outside cwd cannot widen the sandbox — pinned by tests asserting both the workdir and a relative token resolve/flag correctly.
- **Deviations from the plan's Module-Level Changes** (all sound, not gaps):
  - `input-normalizer.ts` and `tool-input-path.ts` were **not** modified — the open question resolved to "not needed": the enforcement path is the gate pipeline (which consults `resolveShellInvocation` directly), and the advisory service (`bash-advisory-check.ts`) resolves `bash` by explicit command string, so neither sees an aliased `(toolName, input)`.
  - `helpers.ts` (`deriveDecisionValue`) was **not** modified — `tool.ts`'s `describeToolGate` threads the effective `bash` `gateSurface` into it, so no change was needed there.
  - `config/config.example.json` was **not** modified — the `shellTools` block already shipped in `#580`.
  - `ShellToolAlias` was **not** reintroduced (the plan's Non-Goal suggested it) — `resolveShellInvocation` uses indexed access on `ShellToolsConfig`, so a named export would have re-tripped the `#580` speculative-export/`fallow` trap.
- **Pre-completion WARNs, both addressed before shipping:**
  1. The plan promised aliased-tool cases for the `#490`/`#481` wrapper-flooring and `#452` fail-closed security invariants, which were missing (they held structurally via shared `resolveBashCommandCheck`).
     Added two integration tests (`sudo` → `<indirection-bash-wrapper>`, `bash -c` → `<opaque-bash-wrapper>`) through the real parse (`d7d19d2e`), so a future `toolName === "bash"` special-case in the flooring path is caught.
  2. The package skill was silent on the new dispatch point — added a `shellTools`/`resolveShellInvocation` gate-parity paragraph (`c6881403`).
- **Parallel-session interaction:** a peer session landed `#583` retro notes on shared `main` between my prep refactor and step 1; my prep refactor rode onto `origin/main` via that push, leaving five unpushed commits.
  History stayed linear; no conflict.
- **Release:** ship now — batch "shell-tool-aliases" tail; landing this cuts the release carrying both the deferred `#580` `feat:` and this issue's `feat:` commits.
  Next step: `/ship-issue`.
