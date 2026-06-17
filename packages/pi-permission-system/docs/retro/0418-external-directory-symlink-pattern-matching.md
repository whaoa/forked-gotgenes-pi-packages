---
issue: 418
issue_title: '[Bug] Even though "Allow" is configured, the permission system still prompts for confirmation on access requests'
---

# Retro: #418 — Even though "Allow" is configured, the permission system still prompts

## Stage: Planning (2026-06-17T14:17:37Z)

### Session summary

Diagnosed the reported false external-directory prompt as a symlink-vs-pattern-matching bug: both external-directory gates resolve `/tmp` → `/private/tmp` (the macOS symlink) before matching, so the user's `/tmp/*` pattern never hits.
The actual firing surface in the report is the **bash** gate (`toolName: "bash"`, `ls -la /tmp/`), driven by `BashProgram.externalPaths` returning the canonical path; the tool gate (`describeExternalDirectoryGate`) has the same defect via `canonicalNormalizePathForComparison` (whose own docstring says "not for pattern matching").
Produced a 6-step TDD plan that matches `external_directory` patterns against both the typed and the symlink-resolved forms as aliases, keeping the canonical path only for the outside-CWD boundary and infra-read checks.

### Observations

- This is a third-party issue (`lipaysamart`); ran the `ask_user` direction gate.
  Operator chose **fix it** and **match both typed and resolved forms** (not lexical-only).
- Deliberately reused the existing resolver surface by adding an optional `surface` param to `resolvePathPolicy`/`checkPathPolicy` rather than adding a new method — architecture.md lines 594–595 flag resolver-surface widening as a risk, and `evaluateAnyValue` (last-match-wins across aliases) is already wired for `PATH_SURFACES`, so the alias mechanism is free.
- Kept `BashProgram.externalPaths(): string[]` shape (value semantics change canonical → lexical, dedup identity stays canonical) to avoid churning its 29 test references; most use synthetic non-existent paths where `canonicalizePath` no-ops.
- Flagged the #393 false-green risk: the gates now resolve through `checkPathPolicy`, so `makeHandler` must route the `external_directory` surface onto `checkPathPolicy` or `makeSurfaceCheck`-driven tests silently pass `allow`.
  The step-5 real-instance acceptance test (real tmpdir symlink) is the backstop.
- Noted a security upside worth keeping in the commit body: the fix also closes a silent-allow hole where a symlinked **deny** (`/tmp/*: deny`) previously fell through to the `*` fallback.
- The tool gate gains a `resolver` parameter (mirroring `describePathGate`); its `input` becomes `{}` and it carries a `preCheck`, like the bash gate already does.
- Distinct from #413 (docs-only discoverability of the `external_directory` allow-list): #418 is a genuine matching bug where the right surface and pattern were already configured.
