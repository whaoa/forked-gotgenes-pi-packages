---
issue: 569
issue_title: "Move the presentation family onto the tool-kind product"
---

# Retro: #569 — Move the presentation family onto the tool-kind product

## Stage: Planning (2026-07-10T00:00:00Z)

### Session summary

Planned Phase 10 Step 2 of the pi-permission-system roadmap: migrate the presentation family (`tool-preview-formatter.ts`, `permission-prompts.ts`, `denial-messages.ts`, `handlers/gates/helpers.ts::deriveDecisionValue`) onto the Step 1 `access-intent/tool-kind.ts` product, consolidating the private `denial-messages.ts::isMcpCheck` derivation into a single shared `isMcpCheck` alongside `classifyToolKind`.
Wrote a five-step TDD plan (one true red for the new `isMcpCheck` unit tests, the rest behavior-preserving refactors under the existing green suite) and committed it as `docs/plans/0569-presentation-tool-kind-product.md`.

### Observations

- **Shared `isMcpCheck` must keep the `source === "mcp"` disjunct.**
  `classifyToolKind(toolName)` keys purely on the tool name, but the presentation MCP-ness derivation also considers `source === "mcp"` — and `deriveSource` (Step 1) can set `source: "mcp"` on a result whose `toolName` is a server-qualified string.
  Two existing characterization tests pin this exact case (`denial-messages.test.ts` "MCP source with target on non-mcp toolName", `tool-preview-formatter.test.ts` "returns undefined for mcp source"), so a naive reduction to `classifyToolKind(...) === "mcp"` would regress.
- **Target-presence separated from MCP-classification (SRP).**
  The old private `isMcpCheck` baked in `&& !!check.target`.
  Chose to make the shared predicate MCP-ness only (no target) and hoist `&& check.target` to the three denial sites and the one prompt site that need it (also gives TS truthy-narrowing); `tool-preview-formatter.ts` deliberately omits it, matching its original which had no target check.
  One predicate, uniform across all four files.
- **Roadmap wording nuance.**
  The Step 2 roadmap entry says "delete `isMcpCheck`" — this means delete the *private* copy in `denial-messages.ts`; the plan promotes a shared `isMcpCheck` to `tool-kind.ts`.
  Noted so the Landed bullet phrases it as relocate-and-share, not a plain delete.
- **Metric outcome.**
  After migration the recompute grep (`toolName === "(bash|mcp)"|source === "mcp"`) drops from 12 to an expected 2, both inside `tool-kind.ts` (the module docstring and the `source === "mcp"` disjunct in `isMcpCheck`) — within the Phase 10 end-state target of ≤ 4.
  Migrated `classifyToolKind(x) === "bash"` does not match the grep (the `)` before `===`), as confirmed by Step 1.
- **`deriveDecisionValue` empty-path fallback.**
  The original `if (path) return path; return toolName` treats `""` as falsy; preserved with a truthy ternary (not `??`), pinned by `helpers.test.ts`.
- **Release posture.** `refactor:` (hidden changelog type), **tail** of batch "tool-kind-dispatch" (head Step 1 / #568 landed) → ship now (land the batch tail); does not cut a release on its own, auto-batches into the next releasing change.
- **First-party, unambiguous** → no `ask_user` gate; the one design choice (single no-target predicate) was resolved via code-design/SRP heuristics and existing characterization coverage.
