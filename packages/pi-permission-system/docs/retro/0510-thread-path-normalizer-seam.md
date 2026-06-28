---
issue: 510
issue_title: "Thread an injected platform/path-semantics seam through the bash path pipeline"
---

# Retro: #510 — Thread an injected platform/path-semantics seam through the bash path pipeline

## Stage: Planning (2026-06-28T00:00:00Z)

### Session summary

Planned the refactor that completes the half-built platform seam in the bash path pipeline.
The operator's `ask_user` answers reshaped the design away from the issue's literal "thread a `PathSemantics`/`NodeJS.Platform` knob" framing toward a single injected collaborator — `PathNormalizer` — constructed at the edge with both `platform` and `cwd` baked in, handed raw tokens, and returning the prepared values (`AccessPath`s + routing answers) the gates expect ("prepare the data before evaluation, not during evaluation").
Confirmed a behavior-preserving `refactor:` that batches into [#508]'s `fix:` release, full enforcement scope (lint guard + `rule.ts`/`subagent-context.ts` cleanup), and a 10-step lift-and-shift TDD order.

### Observations

- **Design steer (via `ask_user`).**
  Rejected both "bare `NodeJS.Platform`" and a passive `PathSemantics` value bag.
  The operator's framing: hand paths to a collaborator that *owns* platform + cwd and figures out the normalized forms.
  Result: `PathNormalizer` (name chosen over `AccessPathFactory`/`PathInterpreter`), single collaborator owning both `AccessPath` construction and routing (`isAbsolute`/`resolveBase`/`joinBase`/`isWithinDirectory`/`isOutsideWorkingDirectory`).
- **Two distinct edges.**
  `process.platform` is process-global → read once in `index.ts` (factory body), injected into `PermissionManager` (for `rule.ts`) and `PermissionSession`.
  `cwd` is session-scoped → not available in the factory body; arrives at `session_start` via `resetForNewSession(ctx)`, so `PathNormalizer` is built there and exposed via `getPathNormalizer()` on the existing `ToolCallGateInputs` seam.
- **`cwd` source change is the main risk.**
  Today the pipeline reads `ctx.cwd` per tool call; baking it into the session normalizer assumes per-session stability.
  Holds for Pi (a session is bound to one project dir), and `resetForNewSession` rebinds on every `/new`/`/resume`/`/fork`.
  Flagged with a composition-root regression test.
- **Behavior-preserving by construction.**
  Every converted interior op already used host `node:path`/`process.platform`, so the host-default result is identical; the only POSIX-hard-coded drift (`isRelativeCandidate`'s `startsWith("/")`) is deliberately left as-is and deferred to [#508], keeping this a pure `refactor:` with no observable POSIX change.
  `canonicalizePath`'s new `win32` split is a no-op on POSIX and a latent fix validated by injected-`win32` unit tests.
- **Release framing.**
  Not in the Phase 7 roadmap (the issue proposes it as a new step); marker is "ship independently" with the rationale that a `refactor:` does not cut its own release — it auto-batches into [#508]'s `fix:`.
  Avoided the formal batch-tail marker since there is no named roadmap batch.
- **Scope boundary vs. [#505].**
  `PathNormalizer` is a facade over the platform-parameterized `path-utils`/`AccessPath`, not a relocation; the Phase 7 [#505] path-utils dissolution can later move internals behind it without re-touching the seam.
  No new follow-up issue filed (the deferred `isRelativeCandidate` conversion already lives in [#508]).
- **Testability payoff.**
  The whole point is exercising Windows behavior on a POSIX CI by injecting a `win32` `PathNormalizer` — no `vi.mock("node:path")`.

## Stage: Implementation — TDD (2026-06-28T18:35:00Z)

### Session summary

Completed the 10-step plan: steps 1–6 (leaf-normalizer platform flavor, `AccessPath` platform option, the `PathNormalizer` collaborator, session-edge construction, the `BashPathResolver` rename, and the gate migration) landed in a prior session; this session executed steps 7–10 (inject `platform` into `rule.ts` evaluation, into `subagent-context.ts` detection, the `process.platform` ESLint guard + removal of all interior defaults, and the architecture/SKILL docs).
The test count rose from 2183 to 2189 (+6: the `rule.ts` and `subagent-context.ts` win32/posix injection assertions).
Final state: all 10 `#510` commits green on `pnpm run check` / `pnpm run lint` / 2189 tests / `pnpm fallow dead-code`; pre-completion reviewer returned **PASS**.

### Observations

- **`required` vs defaulted platform param (operator decision via `ask_user`).**
  Chose required params (no `= process.platform` default) on `rule.ts`, `subagent-context.ts`, and every `path-utils`/`canonicalize-path` leaf — fully `tsc`-enforced threading — over a lower-churn posix-literal default.
  `PermissionManager`'s constructor option `platform?` keeps an internal `?? "linux"` default (its only production caller, `index.ts`, passes `hostPlatform`), which contained the manager-construction test churn.
- **`evaluate` param reorder.**
  `evaluate`'s optional `defaultAction` blocked a required trailing `platform`, so the signature became `evaluate(surface, pattern, rules, platform, defaultAction?)`.
  Migrated ~84 `rule.ts`/`synthesize`/`session-rules` test call sites with a paren-balancing Python script (append `"linux"` for 3-arg calls, insert before `"deny"` for `defaultAction` calls, drop the old `undefined,` slot for the win32 calls).
- **Step-9 blast radius exceeded the plan (operator-confirmed deviation).**
  The plan named only `isPathWithinDirectory`/`isPiInfrastructureRead`, but the package-wide lint guard forbids the *text* `process.platform`, so **all** leaf defaults had to go.
  That forced threading `platform` to ~6 production sites the plan did not enumerate: `input-normalizer` (via `manager.platform`), the `tool`/`skill-read`/`external-directory` gates (via a new `ToolCallGateInputs.getPlatform()` off the session), and `skill-prompt-sanitizer` (via `before-agent-start` → `session.getPlatform()`).
  Test churn (~93 path-utils call sites + `AccessPath.forPath({ cwd })` object injection) was automated with a second paren-balancing script.
- **Lint-guard sanity check gotcha.**
  Verifying the guard fires (temporarily adding an interior `process.platform`) used `git checkout` to revert — which also reverted the *uncommitted* step-9 change to `canonicalize-path.ts`.
  Caught it (`grep "= process.platform"`) and re-applied before committing.
- **`getPlatform()` alongside `getPathNormalizer()`.**
  Two session accessors on `ToolCallGateInputs`: the normalizer for the bash pipeline, and the bare `platform` for the rule/gate sites that call raw `path-utils`/`isPiInfrastructureRead` rather than an `AccessPath` op.
  The reviewer confirmed the split is correct (path-interpretation vs. rule case-folding are distinct concerns).
- **Pre-completion reviewer: PASS** — all deterministic checks green, all cross-step invariants ([#418], [#393], [#308], [#382], [#478]) preserved, all 4 Mermaid diagrams validated, no dead code, docs forward/reverse complete.
  No WARN findings.
- **Doc note.** `architecture.md` recorded the seam as "### Related: PathNormalizer platform seam ([#510])" under Phase 7 (a precursor refactor, not one of the five Phase 7 steps), updated the `cwd-projection.ts` → `bash-path-resolver.ts` rename, the `BashProgram.parse` signature, the `evaluate()` pseudo-code, and added a `path-normalizer.ts` module entry.
