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
