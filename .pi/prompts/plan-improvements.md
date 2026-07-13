---
description: Form a cause hypothesis from the architecture doc, corroborate with fallow, and propose the next improvement phase
---

# Plan the next improvement round

Package: `$1`

Your job is to analyze the package, identify structural improvements, and propose a numbered phase plan.
Do **not** start implementation — only produce the analysis and plan.

## Sync with remote (do this first)

1. Run `git pull --ff-only`.
2. If it fails for **any** reason — uncommitted changes, divergent history, merge conflict, network error, detached HEAD — stop immediately and report the failure to the user.
   Do not attempt to stash, rebase, force, or otherwise resolve.
3. Only proceed once the pull reports a clean fast-forward (or `Already up to date.`).

## Load skills

Load these skills before starting analysis:

- `improvement-discovery` — heuristics, smell taxonomy, prioritization framework.
- `fallow` — how to run and interpret fallow output.
- `package-<PKG>` — package-specific context (replace `<PKG>` with `$1`).
- `code-design` — design principles and structural heuristics.
- `markdown-conventions` — for the output document.

## Analysis (follow the improvement-discovery workflow)

### Step 1: Read the architecture document and form a cause hypothesis

Start from first principles, before running any tool — fallow finds symptoms by construction (it is syntactic), so leading with it frames the whole analysis around symptoms.

Read `packages/$1/docs/architecture/architecture.md`.
Note:

- Current health metrics table
- Dependency bag inventory — which are marked done vs. open
- Complexity hotspots
- Churn hotspots

Determine the next phase number N (last completed phase + 1), then immediately call `set_session_name` with `$1 — Phase N Planning` so the session is labelled for the rest of the work.

**Hard gate — the previous phase must be archived first.**
If Phase N−1's full detailed roadmap (numbered steps with `Outcome:` lines and a dependency diagram) is still inline in `architecture.md` rather than condensed to a completion summary linking a `history/phase-(N−1)-<slug>.md` file, stop and tell the user to run `/finish-phase $1` first, then resume `/plan-improvements $1`.
Archiving the prior phase — with its step-completion gate and doc reconciliation — is `/finish-phase`'s job; do not do it inline here.

A declared direction for Phase N most often lives **not** in `architecture.md` but in the previous phase's history file — `history/phase-(N−1)-<slug>.md`, whose **Findings** section is where `/finish-phase` records the "leading Phase N candidate."
Read that history file's Findings before deep-tracing.
If it (or `architecture.md`) already declares a direction, treat it as a hypothesis, not a commitment — but put the declared candidate in front of the user in your **first** `ask_user`, up front, not a follow-up: a declared candidate surfaced late forces a second round-trip after the composition is already drafted.
Let the discovery findings decide.

Before touching any tool, write down a **cause hypothesis**: the first-principles structural problem you expect the next phase to dissolve (structural fusion, a coupling/boundary flaw, a dead subsystem), read against the architecture doc's first-principles section.
The later steps corroborate, refine, or refute it — they do not replace it.
A cause-level finding must trace to a named target concept in the architecture doc's first-principles section; when no such section exists, writing one — naming the organizing concept and recording resolved design directions — is itself a phase deliverable.

### Step 2: Sweep open issues

Reconcile the tracker against the architecture doc — doc/tracker drift otherwise causes re-planning filed work or missing a parked candidate.

```bash
gh issue list --label "pkg:$1" --state open
```

Cross-check each open issue against the architecture doc's claims about which issues remain open, and note any that are parked candidates for this phase or already-filed work you must not re-plan.
Track repeat deferrals: an issue swept as out-of-scope across multiple consecutive phases (check the prior phase retros/roadmaps) gets an explicit decision this phase — schedule it, or recommend closing it as not-planned — never a silent re-defer.
Surface each repeat-deferral as an explicit `ask_user` decision (schedule / defer-with-recorded-rationale / close as not-planned), not a self-made call — these are preference-sensitive judgments the user should own.

### Step 3: Run fallow for corroboration and baseline

Fallow **corroborates** the cause hypothesis and supplies outcome baselines (LOC, complexity, dead code, duplication) — it does not set the agenda.
Run the full suite from the repo root (the exact commands and interpretation live in the `fallow` and `improvement-discovery` skills you loaded); record the health score, dead-code findings, production/test duplication, hotspots, and refactoring targets.
Also run the repeated-discriminator sweep from the `improvement-discovery` skill (the `grep … | uniq -c` one-liner in its Step 3) — fallow is blind to that smell class, so the sweep is the only detector.

**The phase spine must not be fallow-sourced-only.**
At least the primary cause must trace to the principle-driven reading of Step 1, not to a syntactic fallow finding — cite fallow signals as symptoms of that cause, not as the motivation for a step.

### Step 4: Trace from entry point outward

Read `packages/$1/src/index.ts` and trace its dependency graph:

- For each import, read the target module
- Note size, exports, fan-out, code smells
- Pay special attention to: `as any` casts, adapter closure density, forward references, wide parameter lists, mixed responsibilities, anemic domain objects (data classes that a manager reaches into instead of telling), repeated discriminators (the same comparison re-evaluated across modules instead of decided once at a boundary)

### Step 5: Read the tests as evidence of constructibility

`fallow`'s metrics miss god objects, closure density, and DIP violations.
Read the largest test files and `test/helpers/`: module-level `vi.mock`, wide `as unknown as` casts, and multi-field fixtures (a `makeX` stubbing 10+ methods, or one mock passed to a constructor several times) mean the production object is hard to construct — a production smell, not a test-tree problem.
Do not accept the architecture doc's self-justification for a smell at face value; verify the claim against the code and tests.
When the analysis touches handler wiring or shared interfaces, load the `design-review` skill before writing the plan.

### Step 6: Assess file and directory organization against the domain

**Skip this step when domain subdirectories already exist and the `src/` root file count is small** (fewer than 10 top-level files): the deep directory-organization analysis is a scripted no-op on a package that has already been grouped into domains.
Run `ls packages/$1/src | grep -c '\.ts$'` to check the root file count and note the skip.

Otherwise, run `ls packages/$1/src` and look at the shape of the tree, not just the contents of files.
A flat `src/` with many top-level modules (20+) is a Category E smell ("Flat directory" in the `improvement-discovery` taxonomy): navigation degrades, and the absence of grouping hides which files form a cohesive feature or domain concept.
Watch for a module that will not sit still in any obvious group — that usually means the organizing concept has not been named yet, and the reorg should wait on (or motivate) the work that names it.

When a regrouping opportunity exists, prefer to **introduce or grow a domain directory in a phase that is already rewriting or extracting those files** (tidy-first), so the touched modules reach their final home the first time instead of being moved twice.
Do **not** propose a big-bang move of the whole tree — it is unreviewable and collides with every in-flight branch.
The `#src/*` / `#test/*` import aliases keep moves mechanical (a move rewrites only the importing `#src/<file>` sites, with no `../../` fragility, and `tsc` + eslint catch every miss).
A domain directory may expose a lean `index.ts` barrel as its cross-domain API, but only at genuine seams — this repo treats barrel re-export sprawl as a smell and fallow flags any export with no importer.

Reorg scope is preference-sensitive (churn vs. coherence), so when the opportunity is larger than the files the phase already touches, use `ask_user` to decide how much to fold in.
When the full reorg exceeds the current phase, record a **forward-looking directory sketch** (the target domain directories + these principles) in the architecture doc and seed only the first domain now — see the pi-permission-system Phase 6 "Directory organization" section for the pattern.

### Step 7: Apply the smell taxonomy

For each finding, classify it using the taxonomy from the `improvement-discovery` skill (Category A–E).
Score each on Impact (1–5) and Risk (1–5).
Compute Priority = Impact × (6 − Risk).

### Step 8: Propose the phase plan

Group findings into issue-sized steps.
Nine steps is a **ceiling, not a target** — a phase may have one step, or none.
Identify dependency ordering and parallel tracks.

**Deferral gate.**
If discovery surfaced no cause-level finding (Category A–C — structural fusion, coupling/boundary flaws, dead subsystems) and the candidate list is polish-only (Category B unit-size, Category D, Category E symptoms), say so plainly and present **"defer"** and **"lean phase"** as first-class `ask_user` options alongside a full phase.
This is deliberately **not** a numeric threshold — the priority score ranks findings _within_ a phase, it does not decide _whether_ a phase exists.
The honest framing ("discovery yielded only polish") is the point; do not manufacture a full phase to fill the ceiling.
When the architecture doc's declared target is complete and discovery yields only polish, the fired gate is the improvement process reaching its intended terminal state — report it as success, not as a failure to find work; the next phase's trigger is a new cause, not the calendar.

**Track composition.**
When the surviving candidates span multiple independent tracks (a spine plus unrelated parallel work), offer the composition to the user via `ask_user` (a multi-select over the tracks) rather than committing to a fixed set — track selection is preference-sensitive (scope vs. focus), and the user may want to drop or add a track before you draft the steps.

**Feasibility probe.**
Before committing any step whose outcome claim depends on the SDK/type surface (e.g. "remove the file-level `eslint-disable` once the SDK exports usable types"), confirm the named type or export actually exists in the real surface (SDK `.d.ts`, `--help`, schema).
Do not commit an outcome the surface cannot deliver — this mirrors the AGENTS.md rule that a named remediation in a migration note must be verified against the real surface.
For an SDK **UI or behavioral** capability (not just "does this method exist"), confirm the behavior in the Pi core source (`~/development/pi/pi`) and a sibling extension that already uses it, not only the exported type — a `.d.ts` says a method exists but not that it behaves the way the step needs (e.g. `ctx.ui.custom` renders inline by default only per the core's `overlay ?? false`, invisible in the type signature).

## Output

Write the proposed plan as a new `## Improvement roadmap — Phase N: <title>` section in `packages/$1/docs/architecture/architecture.md`, inserted **above the most recent completed-phase summary**.
`/finish-phase` has already condensed prior phases into a chain of `## Improvement roadmap — Phase N−1: … (complete)` summaries; insert above them, do not overwrite them.

The section should include:

1. A summary of findings (updated health metrics table).
   Prefer cause-level metrics recomputable by a single command (a `grep -c`, `wc -l`, or fallow field) and record the recompute command with the metric, so `/finish-phase` can verify delivered vs. predicted deterministically.
2. Numbered steps with:
   - Title
   - **Cause** — the first-principles structural cause the step dissolves, named explicitly; a fallow signal is cited as the _symptom_ of that cause, never as the step's motivation (a step justified only by a fallow finding is symptom-driven — trace it to a cause or drop it).
   - Target files/functions — when a step extracts or moves code and a domain directory applies (Step 6), name the destination path (e.g. `src/<domain>/<file>.ts`) so directory placement rides along with the change rather than landing flat and being moved later.
   - Smell category addressed
   - Expected measurable outcome
   - **Impact / Risk / Priority** — the per-step scores (`Priority = Impact × (6 − Risk)`), published on the step so the ranking is auditable in the committed roadmap and at `/plan-issue` time, not left in the session transcript.
   - A `Release:` tag on its own line — `Release: independent` or `Release: batch "<batch-name>"` (see the `improvement-discovery` skill's Output format).
3. Step dependency diagram (Mermaid flowchart).
4. Named parallel tracks.
5. A `Release batches` subsection (after the parallel tracks) naming each batch, its member steps in dependency order (last listed = tail), and the independently releasable steps.
   This is the deterministic source `/plan-issue` reads to recommend a release decision — keep it grep-able, not prose.

After writing the plan, present a summary to the user and ask whether to commit.
If confirmed, commit with:

```bash
git add packages/$1/docs/architecture/architecture.md
git commit -m "docs($1): propose Phase N improvement roadmap"
git push
```

## File the issues

The roadmap is not done until each step has a GitHub issue and the document links back to it.
After the plan is committed, ask whether to file the issues now; if confirmed:

1. Load the `github-voice` skill, then file the issues **one `gh issue create --label "enhancement,pkg:$1"` call per issue**, with the title and `--body-file` paired literally in the same command — never via shell-array index arithmetic (the shell is zsh; its 1-indexed arrays silently shift titles relative to bodies).
   Run `gh` from the repo root (it must execute inside the repository).
   Use the repo's `## What` / `## Why` / `## Proposed change` / `## Context` sections, referencing cross-step dependencies as "Phase N Step M" prose, not hardcoded numbers (the issue numbers are not known until filed).
2. Verify each created issue's title matches its body before continuing.
3. Link the doc back: append `([#N])` to each step heading, add `(#N)` to each Mermaid node, and add reference-link definitions at the end of the file.
   Then verify every `[#N]` reference in the file resolves to a matching `[#N]:` definition — `rumdl`'s MD053 flags _unused_ definitions but not _missing_ ones, so a dangling reference inherited from a prior phase's summary passes lint silently; add any missing definitions while you are in the file.
4. Commit with `docs($1): link Phase N roadmap steps to issues #A-#B` and push.

Finally, restate the recommended working sequence: list the issues as `#N — title` lines in dependency order (a topological order of the step diagram), noting which can proceed in parallel and which are blocked until an earlier one lands.

## Write planning notes

Before stopping, persist planning observations for cross-session continuity — `/plan-improvements` is phase-scoped, not issue-scoped, so it uses a **phase retro** file rather than the issue-keyed `NNNN-<slug>.md` convention.

1. Write `packages/$1/docs/retro/phase-N-<slug>.md` (create `packages/$1/docs/retro/` if needed), using the phase number N and slug from Step 1.
   This is distinct from the `history/phase-N-<slug>.md` archive `/finish-phase` owns — do not touch that.
2. If the file does not exist, create it with this frontmatter (a phase-scoped variant — `package`/`phase` keys, not the issue-keyed schema):

   ```markdown
   ---
   package: $1
   phase: N
   ---

   # Retro: $1 — Phase N Planning (<slug>)
   ```

3. Append a stage entry:

   ```markdown
   ## Stage: Improvement Planning (<ISO 8601 timestamp>)

   ### Session summary

   2–3 sentences: the cause hypothesis (Step 1) and the phase shape chosen (full / lean / deferred).

   ### Observations

   The cause the phase dissolves, alternatives or deferrals considered, the deferral-gate outcome, and any feasibility-probe results that reshaped a step.
   ```

4. Commit with `docs($1): add Phase N planning retro notes` and push.

Wrap code identifiers, filenames, and underscore-bearing text in backticks.
Append with the `Edit`/`Write` tools, not a shell heredoc.
Then stop.
