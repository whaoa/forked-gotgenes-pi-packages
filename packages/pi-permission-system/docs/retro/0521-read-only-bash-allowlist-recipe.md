---
issue: 521
issue_title: "Is it possible to setup allow for all read-only commands?"
---

# Retro: #521 — Is it possible to setup allow for all read-only commands?

## Stage: Planning (2026-07-12T00:00:00Z)

### Session summary

Planned Phase 10, Step 6 of the pi-permission-system roadmap: a documentation-only recipe adding a "Read-Only Bash Command Allowlist" to `docs/configuration.md`.
The issue is third-party (`johnsyin-nextbe`), so the `ask-user` gate ran; it confirmed an in-doc recipe only (no shippable example config) with a conservative curated allowlist.
The plan is a single-commit build (`/build-plan`), landing the recipe and the roadmap `✅` marker together.

### Observations

- The issue's second question — allow `find *` while `-exec` and chains still `ask` — is **already fully implemented**: `find`/`fd` with an exec flag is floored `allow` → `ask` (indirection-wrapper floor, [#490]), and chains decompose to most-restrictive.
  The recipe documents this rather than building it.
- The owner had already scoped the direction in `docs/architecture/architecture.md` (Phase 10, Step 6, `Release: independent`, `Cause: none (documentation)`), so the third-party `ask-user` gate served to resolve genuine scope ambiguity (artifacts + breadth) rather than whether to build.
- `ask-user` initially returned "broad with caveats" for breadth; the operator immediately corrected to **conservative**.
  Final: in-doc recipe only, conservative allowlist.
- Key safety insight for the recipe: a curated read-only bash allowlist is safe *because of* four existing nets — the exec-flag floor ([#490]), the wrapper floor ([#481]), chain most-restrictive decomposition, and redirect targets being gated by the `path` surface (not `bash`).
  The one real hole to warn about is the redirect (`cat x > y` writes `y`), mitigated by shipping the recipe with `write`/`edit` denied and a `path` deny block.
- `git *` is deliberately never used — only specific read subcommands (`git status`, `git diff *`, `git log *`, etc.), since `git` has mutating subcommands.
  Exact patterns keep `git branch -D` falling through to `ask`.
- `echo`/`printf`/`tee`/`sort`/`sed`/`awk` excluded from the conservative set (redirect payloads, `-o`/`-i` in-place writes).
- Release: ship independently — unhidden `docs:` change, cuts its own release.

### Diagnostic details

- **Model-performance correlation** — planning ran entirely in the main session; no subagents dispatched (docs-only, small surface).
- **Feedback-loop gap analysis** — an early `Read` on `config.example.json` / `configuration.md` failed on a wrong absolute path (missing the `pi-packages/` segment); corrected on the next call.
  Minor, no rework.
