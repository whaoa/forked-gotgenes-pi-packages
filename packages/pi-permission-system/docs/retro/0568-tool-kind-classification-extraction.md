---
issue: 568
issue_title: "Tool-kind classification decided once at the normalize boundary (extraction family)"
---

# Retro: #568 — Tool-kind classification decided once at the normalize boundary (extraction family)

## Stage: Planning (2026-07-10T00:00:00Z)

### Session summary

Planned Phase 10 Step 1 of the pi-permission-system roadmap: a new `access-intent/tool-kind.ts` owning a `ToolKind` string-union classification and its single dispatch point `classifyToolKind`, with the five extraction-family consumers (`input-normalizer.ts`, `tool-input-path.ts`, `handlers/gates/tool.ts`, `handlers/gates/tool-call-gate-pipeline.ts`, `permission-manager.ts`) migrated onto it.
Wrote a five-step TDD plan (one true red for the new module, the rest behavior-preserving refactors under the existing green suite) and committed it as `docs/plans/0568-tool-kind-classification-extraction.md`.

### Observations

- **Bare union over rich product.**
  Chose a plain `ToolKind` string union rather than a discriminated object carrying the extracted command/target/path.
  A rich product would need the MCP server-name list, the extractor registry, and `AccessPath` — the last is forbidden in `permission-manager.ts` by the ADR-0002 `no-restricted-imports` rule, and the pipeline's bash guard and `deriveSource` have none of those inputs in hand.
  The classification is the single missing dispatch point; per-kind products stay where their dependencies live.
- **Extraction vs presentation split confirmed by grep.**
  The official recompute (`toolName === "(bash|mcp)"|source === "mcp"`) returns exactly 21: 10 extraction sites (this step) + 11 presentation sites (Step 2, #569).
  The metric keys literally on `toolName ===`/`source ===`, so consumers dispatching on a `classifyToolKind`/`kind`-named value produce zero grep matches — extraction drops to 0, total to 11 (≤ 12 target).
- **`getToolPermission` dead branches.**
  Found that `getToolPermission`'s `normalizedToolName === "bash"`/`"mcp"`/`"skill"` branches (not grep-counted — different variable name) plus the SPECIAL and default arms all evaluate the identical `evaluate(normalizedToolName, "*", composedRules, platform).action`.
  Folded a behavior-identical collapse into the manager migration step; flagged as optionally droppable in Open Questions.
- **`buildInputForSurface` deliberately excluded.**
  It dispatches on path/service **surface** names (`external_directory` has no `ToolKind` variant), not tool names, so `classifyToolKind` would drop a branch — left as-is and recorded in Non-Goals.
- **ADR-0002 boundary holds.**
  `tool-kind.ts` imports only the pure `PATH_BEARING_TOOLS` set, staying `AccessPath`-free, so `permission-manager.ts` importing `classifyToolKind` does not breach the string boundary.
  Noted as an at-risk invariant pinned by the existing ESLint rule.
- **Release posture.** `refactor:` (hidden changelog type), head of batch "tool-kind-dispatch" (tail = Step 2, #569) → mid-batch defer; does not cut a release on its own.
- **First-party, unambiguous** → no `ask_user` gate; the one design choice (union vs product) was resolved via code-design heuristics.
