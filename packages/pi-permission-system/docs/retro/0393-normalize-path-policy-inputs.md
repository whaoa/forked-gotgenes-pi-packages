---
issue: 393
issue_title: "fix(pi-permission-system): normalize path policy inputs"
---

# Retro: #393 — fix(pi-permission-system): normalize path policy inputs

## Stage: PR Review (2026-06-12T14:20:51Z)

### Session summary

PR #393 (third-party, `@moekyo`) makes the path gates match relative tool/bash inputs against absolute allowlist rules by feeding the evaluator a set of equivalent "policy values" (absolute, project-relative, raw) derived from the known working directory.
The underlying gap is real: `PermissionManager.configureForCwd` already records the cwd, but the evaluator never used it, so a relative input like `src/App.jsx` could never match an absolute rule such as `/workspace/project/*`.
The operator chose to **adopt the capability and plan a simplified design** (direction 1), treating the PR as reference rather than the merge target, and to classify the behavior change as **breaking** (`feat!:`/`fix!:`).

### Evaluation

**Valuable core (keep):**

- `getPathPolicyValues` / `normalizePathPolicyLiteral` (`src/path-utils.ts`) —
  a clean way to derive the equivalent lookup forms for a path, reusing the
  existing `normalizePathForComparison` lexical cleanup.
- `evaluateAnyValue` (`src/rule.ts`) — genuinely distinct from `evaluateFirst`: it preserves global last-match-wins **across** aliases of the same path, so a catch-all match on the first alias can't mask a later, more specific rule on another alias.
  This is the right semantic for "same path, multiple spellings" and is correctly gated behind `PATH_SURFACES` in `permission-manager.ts` while MCP (genuinely different targets) keeps `evaluateFirst`.
- The cwd plumbing in `permission-manager.ts` (`currentCwd` captured in
  `configureForCwd`, threaded into `normalizeInput`).

**What I would change (simplify):**

- **Symbol side-channel.**
  `INTERNAL_PATH_POLICY_VALUES` (`src/input-normalizer.ts`) smuggles bash's pre-computed policy values through a symbol-keyed field on the tool `input` object — threaded `bash-path.ts` → `resolver.resolve` → manager → `normalizeInput`, then re-stamped onto the gate descriptor's `input` so it survives the post-approval gate run.
  This is over-wide threading and a divergent shape: `input` is meant to be raw tool input, and the gate now special-cases a symbol on it.
  The user-string guard (`getInternalPathPolicyValues` reads only the symbol, never a `pathPolicyValues` string key) is the correct least-privilege instinct, but the mechanism it protects is the part to rework.
  The real driver is that bash needs a per-token `resolveBase` (the effective dir after a literal `cd`) that `normalizeInput` can't compute — a simplified design should pass that resolution context explicitly rather than as a symbol on `input`.
- **Orphaned `pathTokens()`.**
  After the refactor, `bash-path.ts` consumes the new `pathRuleCandidates(cwd)` and `BashProgram.pathTokens()` is reachable only via `extractTokensForPathRules` (`bash-path-extractor.ts`), which is itself referenced **only** by `test/bash-external-directory.test.ts`.
  The PR keeps the method alive with a `fallow-ignore-next-line unused-class-member` comment instead of removing the now test-only chain.
  Per the package skill ("treat any declared field not read at runtime as a maintenance trap"), the simplified design should delete the orphaned `pathTokens` / `extractTokensForPathRules` surface, not suppress the flag.
- **Minor:** `evaluateAnyValue`'s returned `value` (the matching alias) is consumed only for MCP extras in `checkPermission`; for path surfaces it is discarded.
  Symmetry with `evaluateFirst` is fine, but worth noting the alias selection does no work on the path path.

**Behavior / breaking:** The change flips decisions on upgrade with no config edit.
In the loosening direction it weakens a gate — e.g. `path: { "*": "ask", "/workspace/project/*": "allow" }` turns a relative `src/App.jsx` from `ask` → `allow`.
For a least-privilege package that is a breaking change; the operator confirmed `feat!:`/`fix!:` with a migration note.

### Decision and attribution

**Direction:** Adopt the capability, plan a simplified design (use #393 as reference, not the merge target).
**Scope (in):** the `getPathPolicyValues` + `evaluateAnyValue` core, cwd plumbing, and docs/schema updates.
**Non-goals / rework:** drop the `INTERNAL_PATH_POLICY_VALUES` symbol side-channel in favor of explicit per-token resolution context for bash; remove the orphaned `pathTokens` / `extractTokensForPathRules` chain instead of `fallow-ignore`-ing it.
**Classification:** breaking (`feat!:`/`fix!:`) with a migration note covering the loosening case.

`/plan-issue` should plan around this recorded decision (the Decide gate is satisfied here) rather than re-litigate the direction.

**Attribution (required on every implementation/docs commit):**

```text
Co-authored-by: moekyo <shigotods@outlook.com>
```

The ship-stage PR close comment thanks `@moekyo` by name and links the implementing SHA(s).
Reference the PR as `Refs #393` / `(#393)` in commits — never `Closes #393` (it pre-empts the curated close comment).

## Stage: Planning (2026-06-12T00:00:00Z)

### Session summary

Produced `docs/plans/0393-normalize-path-policy-inputs.md` planning the simplified design the PR-review stage chose: keep `getPathPolicyValues`/`normalizePathPolicyLiteral`, `evaluateAnyValue`, and the cwd plumbing, but replace the `INTERNAL_PATH_POLICY_VALUES` symbol side-channel with an explicit `checkPathPolicy`/`resolvePathPolicy` method pair and remove the orphaned `pathTokens`/`extractTokensForPathRules` chain.
The `Decide` gate was already satisfied by the recorded PR-review decision, so the third-party `ask_user` direction gate was not re-run.
Plan is 9 TDD cycles (two `feat!:`), committed; next step is `/tdd-plan`.

### Observations

- Confirmed `runDescriptor` (`runner.ts`) uses `descriptor.preCheck` whenever set, and the bash path gate always sets it — so the PR's symbol stamp on `descriptor.input` was vestigial.
  The simplified design carries the per-token policy values through a dedicated resolver method instead of any field on `input`, eliminating both the symbol and the user-string-spoofing concern.
- Chose a new narrow method (`checkPathPolicy(values)` on `ScopedPermissionManager`, `resolvePathPolicy(values)` on `ScopedPermissionResolver`) over threading a `resolveBase` through `resolve`/`normalizeInput`: the `unknown`-base and no-cwd "literal only" decisions are bash-specific, so bash must own value computation and pass the finished array.
- Flagged the interface breaks (steps 4 and 5) as fold-fixtures-in-same-commit: `makeFakePermissionManager` (`session-fixtures.ts`) gains `checkPathPolicy`; `makeResolver`/`makeGateRunner`/`makePathDispatchResolver` (`gate-fixtures.ts`) gain `resolvePathPolicy`; grep both interface names for inline mocks.
- Used lift-and-shift for `pathTokens` removal (add `pathRuleCandidates` → migrate gate → delete) to keep every commit compiling.
- Did not port the PR's symbol-spoofing tests; replaced with one `normalizeInput` no-side-channel assertion.
- Breaking classification kept (`feat!:` on the manager and bash-gate steps) — relative inputs now match absolute allowlists, a loosening change for a least-privilege package; no config opt-out is named because none exists.
