import { isAbsolute, join, resolve } from "node:path";
import {
  type BashCommand,
  collectCommands,
} from "#src/access-intent/bash/command-enumeration";
import {
  ARG_NODE_TYPES,
  SKIP_SUBTREE_TYPES,
} from "#src/access-intent/bash/node-text";
import { getParser, type TSNode } from "#src/access-intent/bash/parser";
import {
  collectCommandTokens,
  collectPathCandidateTokens,
  collectRedirectTokens,
  extractCommandName,
} from "#src/access-intent/bash/token-collection";
import { canonicalizePath } from "#src/canonicalize-path";
import {
  classifyTokenAsPathCandidate,
  classifyTokenAsRuleCandidate,
} from "#src/handlers/gates/bash-token-classification";
import {
  getPathPolicyValues,
  isPathWithinDirectory,
  isSafeSystemPath,
  normalizePathForComparison,
  normalizePathPolicyLiteral,
} from "#src/path-utils";

// ── Parsed bash command representation ───────────────────────────────────────

/**
 * The working directory in force where a path candidate appears.
 *
 * A `known` base carries an `offset` to be joined with `cwd` at resolution time
 * (the parse-time walk never sees `cwd`): a relative-or-absolute path string
 * built by folding the literal targets of current-shell `cd` commands (`""` =
 * `cwd`); an absolute offset (from `cd /abs`) ignores `cwd` at resolution time.
 * An `unknown` base marks a non-literal `cd` target (`cd "$DIR"`, `cd $(…)`,
 * `cd -`, bare `cd`, `cd ~…`) that made the effective directory unresolvable.
 */
type EffectiveBase =
  | { readonly kind: "known"; readonly offset: string }
  | { readonly kind: "unknown" };

/**
 * A path-candidate token paired with the effective working directory projected
 * onto the point in the command stream where it appears.
 */
interface PathCandidate {
  readonly token: string;
  readonly base: EffectiveBase;
}

export interface BashPathRuleCandidate {
  /** Raw path-like token shown in prompts, logs, and session approvals. */
  readonly token: string;
  /** Equivalent values used for permission policy matching. */
  readonly policyValues: readonly string[];
}

/**
 * A bash command parsed once into a reusable representation.
 *
 * Parsing is the expensive step (tree-sitter WASM); `BashProgram` performs it
 * a single time and exposes typed slices derived from the same AST walk so the
 * bash permission gates do not each re-parse and re-walk the command, and so
 * the slices are guaranteed to agree.
 *
 * Construct via the async `parse()` factory; the constructor is private.
 */
export class BashProgram {
  private constructor(
    private readonly rawCandidates: readonly PathCandidate[],
    private readonly commandUnits: readonly BashCommand[],
  ) {}

  /**
   * Parse a bash command into a `BashProgram`.
   *
   * Uses tree-sitter-bash to build the full AST and walks command-argument and
   * redirect-destination nodes once into raw candidate tokens, each tagged with
   * the effective working directory projected onto its position by folding
   * current-shell `cd` commands. Heredoc bodies, comments, and other
   * non-argument content are skipped. An unparseable command yields an empty
   * program.
   */
  static async parse(command: string): Promise<BashProgram> {
    const parser = await getParser();
    const tree = parser.parse(command);
    if (!tree) return new BashProgram([], []);

    try {
      const rawCandidates = collectPathCandidates(tree.rootNode);
      const commandUnits = collectCommands(tree.rootNode);
      return new BashProgram(rawCandidates, commandUnits);
    } finally {
      tree.delete();
    }
  }

  /**
   * Path-rule candidates paired with their policy lookup values.
   *
   * When `cwd` is available, each relative token is resolved against the
   * effective working directory in force at the token's position (folding
   * literal current-shell `cd` commands), while raw and project-relative
   * aliases are retained for backward-compatible relative rules. A token after
   * a non-literal `cd` keeps only its literal value so no spurious absolute
   * rule can match.
   */
  pathRuleCandidates(cwd?: string): BashPathRuleCandidate[] {
    const seen = new Set<string>();
    const result: BashPathRuleCandidate[] = [];

    for (const { token, base } of this.rawCandidates) {
      const candidate = classifyTokenAsRuleCandidate(token);
      if (!candidate) continue;

      const policyValues = getPolicyValuesForRuleCandidate(
        candidate,
        base,
        cwd,
      );
      if (policyValues.length === 0) continue;

      const key = policyValues.join("\0");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ token: candidate, policyValues });
    }

    return result;
  }

  /**
   * The top-level command-pattern units of the chain, in source order.
   *
   * Splits on the shell chain operators (`&&`, `||`, `;`, `|`, `&`, newlines);
   * quotes, command substitution, and subshells are respected by the parser and
   * are NOT split — a subshell or other compound statement is emitted whole. May
   * be empty (e.g. an empty command or a comment-only line); callers fall back
   * to the whole command so the surface is never evaluated weaker than before.
   */
  // Used by resolveBashCommandCheck (bash-command.ts) and tests. Fallow's
  // syntactic analysis cannot resolve the static-factory return type (private
  // ctor), so it reports a false positive here.
  // fallow-ignore-next-line unused-class-member
  commands(): BashCommand[] {
    return [...this.commandUnits];
  }

  /**
   * Deduplicated paths that resolve outside `cwd`, in their lexical (as-typed,
   * normalized but not symlink-resolved) form.
   *
   * Each candidate is resolved against the effective working directory in force
   * where it appears, projected by folding a sequence of current-shell `cd`
   * commands (joined by `&&`, `||`, `;`, or a newline). A `cd` inside a
   * pipeline or a backgrounded command runs in a subshell and does not update
   * the running directory; a leading current-shell `cd` before a
   * redirect-then-pipe (`cd a && pnpm x 2>&1 | tail`) folds because bash `|`
   * binds tighter than `&&`/`||`/`;`, even though tree-sitter-bash groups the
   * whole redirected list as the pipeline's first stage (#454).
   *
   * The outside-`cwd` decision and the dedup identity use the canonical
   * (symlink-resolved) form, but the returned value is the lexical form so
   * `external_directory` config patterns match the path as the user typed it
   * (#418); the gate re-derives the canonical alias for matching.
   */
  externalPaths(cwd: string): string[] {
    const normalizedCwd = canonicalizePath(
      normalizePathForComparison(cwd, cwd),
    );

    const seen = new Set<string>();
    const externalPaths: string[] = [];

    for (const { token, base } of this.rawCandidates) {
      const candidate = classifyTokenAsPathCandidate(token);
      if (!candidate) continue;

      // Unknown effective directory: a relative candidate could resolve
      // anywhere, so flag it conservatively (resolving against `cwd` only for a
      // display path). Absolute / `~` candidates are base-independent and
      // resolve normally below.
      if (base.kind === "unknown" && isRelativeCandidate(candidate)) {
        const lexical = normalizePathForComparison(candidate, cwd);
        const canonical = canonicalizePath(lexical);
        if (
          canonical &&
          normalizedCwd !== "" &&
          !isSafeSystemPath(canonical) &&
          !seen.has(canonical)
        ) {
          seen.add(canonical);
          externalPaths.push(lexical);
        }
        continue;
      }

      const resolveBase =
        base.kind === "known" ? resolve(cwd, base.offset) : cwd;
      const lexical = normalizePathForComparison(candidate, resolveBase);
      if (!lexical) continue;
      // The boundary decision and dedup identity use the canonical
      // (symlink-resolved) form, but the returned value is the lexical form so
      // config patterns match the path as the user typed it (#418).
      const canonical = canonicalizePath(lexical);

      if (
        normalizedCwd !== "" &&
        !isSafeSystemPath(canonical) &&
        !isPathWithinDirectory(canonical, normalizedCwd) &&
        !seen.has(canonical)
      ) {
        seen.add(canonical);
        externalPaths.push(lexical);
      }
    }

    return externalPaths;
  }
}

// ── Effective working directory projection ─────────────────────────────────

/** The working directory in force at the start of a program (`cwd`). */
const CWD_BASE: EffectiveBase = { kind: "known", offset: "" };

/** The effective directory after a non-literal or unresolvable `cd`. */
const UNKNOWN_BASE: EffectiveBase = { kind: "unknown" };

/**
 * Walk the AST once, collecting every path-candidate token tagged with the
 * effective working directory projected onto its position.
 *
 * The effective directory is stateful: it starts at `cwd` and each current-shell
 * `cd <literal>` (joined by `&&`, `||`, `;`, or a newline) folds into it for
 * subsequent commands. A `cd` inside a pipeline or a backgrounded command runs
 * in a subshell and does not update the running directory; subshell and
 * brace-group interiors inherit the enclosing base without folding their own
 * `cd`s (a conservative first tier).
 */
function collectPathCandidates(rootNode: TSNode): PathCandidate[] {
  const out: PathCandidate[] = [];
  walkForCandidates(rootNode, CWD_BASE, out);
  return out;
}

/**
 * Collect a single node's candidates tagged with `base`, returning the
 * effective base in force *after* the node (the input base unless the node is a
 * current-shell `cd <literal>` that folds the running directory).
 */
function walkForCandidates(
  node: TSNode,
  base: EffectiveBase,
  out: PathCandidate[],
): EffectiveBase {
  switch (node.type) {
    case "program":
    case "list":
    case "redirected_statement":
      return walkCurrentShellSequence(node, base, out);
    case "command":
      tagTokens(collectCommandTokens(node), base, out);
      return foldCd(node, base);
    case "pipeline":
      // tree-sitter-bash mis-groups a redirect-bearing `&&`/`;` list as the
      // first stage of a pipeline (`cd a && pnpm x 2>&1 | tail` parses as
      // `(cd a && pnpm x 2>&1) | tail`), burying a current-shell `cd` inside a
      // node the `default` case treats as non-folding. Recover bash operator
      // precedence (`|` binds tighter than `&&`/`||`/`;`): fold the first
      // stage's leading current-shell commands while keeping its terminal
      // command and every downstream stage as non-folding subshells (#454).
      return walkPipeline(node, base, out);
    case "subshell":
      // A subshell runs in a child shell: its interior `cd`s fold within the
      // subshell but reset on exit, so the folded base is discarded.
      walkCurrentShellSequence(node, base, out);
      return base;
    case "compound_statement":
      // A `{ … }` brace group runs in the current shell, so its `cd`s persist
      // to following commands — thread and return the folded base.
      return walkCurrentShellSequence(node, base, out);
    default:
      // Pipelines, control-flow bodies, redirect targets, and command/process
      // substitution interiors: collect every candidate in the subtree tagged
      // with the enclosing base and do not fold their internal `cd`s. (Folding
      // inside substitutions is deferred — conservative, never under-flags.)
      tagTokens(collectPathCandidateTokens(node), base, out);
      return base;
  }
}

/**
 * Fold a current-shell sequence (`program` / `list` / `redirected_statement`):
 * thread the effective base left-to-right through the children so a `cd` updates
 * the base for following siblings. A statement immediately followed by the
 * background operator (`&`) runs in a subshell, so its folded base is discarded.
 */
function walkCurrentShellSequence(
  seqNode: TSNode,
  base: EffectiveBase,
  out: PathCandidate[],
): EffectiveBase {
  let current = base;
  for (let i = 0; i < seqNode.childCount; i++) {
    const child = seqNode.child(i);
    if (!child?.isNamed) continue;
    if (SKIP_SUBTREE_TYPES.has(child.type)) continue;
    const after = walkForCandidates(child, current, out);
    current = isBackgrounded(seqNode, i) ? current : after;
  }
  return current;
}

/**
 * Walk a `pipeline` node, returning the effective base in force after it.
 *
 * Each stage of a true pipeline (`A | B | C`) runs in a subshell, so a `cd`
 * inside any stage must not leak — the base normally passes through unchanged.
 * The exception is the first stage: tree-sitter-bash wraps a redirect-bearing
 * current-shell `&&`/`;` list (`cd a && pnpm x 2>&1 | tail`) as that stage, and
 * bash precedence makes the list's leading commands current-shell, so they fold
 * and the folded base persists past the pipeline to following siblings.
 *
 * The terminal command of the first stage is the real pipe stage (a subshell)
 * and must not fold; every stage after a `|` is a downstream subshell stage and
 * collects tokens against the folded base without folding (#454).
 */
function walkPipeline(
  node: TSNode,
  base: EffectiveBase,
  out: PathCandidate[],
): EffectiveBase {
  let current = base;
  let first = true;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child?.isNamed) continue;
    if (SKIP_SUBTREE_TYPES.has(child.type)) continue;
    if (first) {
      current = foldPipelineFirstStage(child, current, out);
      first = false;
      continue;
    }
    // Downstream stage (after a `|`): subshell — collect against the folded
    // base, do not fold.
    tagTokens(collectPathCandidateTokens(child), current, out);
  }
  return current;
}

/**
 * Collect the first pipe stage's candidates, folding its leading current-shell
 * `cd` commands when tree-sitter wrapped a `list` or `redirected_statement`
 * around them. The terminal command of that container is the real pipe stage (a
 * subshell) and is collected without folding. A bare `command` first stage (a
 * true pipeline first stage such as `cd nested | cat ../b`) is a subshell: it
 * collects against the input base and does not fold.
 */
function foldPipelineFirstStage(
  node: TSNode,
  base: EffectiveBase,
  out: PathCandidate[],
): EffectiveBase {
  if (node.type === "list") return foldListExceptTerminal(node, base, out);
  if (node.type === "redirected_statement") {
    let current = base;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child?.isNamed) continue;
      if (child.type === "file_redirect") {
        // Redirect destinations are part of the piped stage; collect them
        // against the folded base without folding.
        tagTokens(collectRedirectTokens(child), current, out);
        continue;
      }
      // The inner statement is the `list`/`command` being redirected; fold its
      // leading current-shell commands via the terminal-excluding walk.
      current = foldPipelineFirstStage(child, current, out);
    }
    return current;
  }
  // Bare `command` or any other shape: a true subshell first stage.
  tagTokens(collectPathCandidateTokens(node), base, out);
  return base;
}

/**
 * Fold every named, non-skip child of a `list` except the last, threading the
 * effective base left-to-right through the leading current-shell commands; the
 * terminal child is the real pipe stage and is collected without folding.
 */
function foldListExceptTerminal(
  node: TSNode,
  base: EffectiveBase,
  out: PathCandidate[],
): EffectiveBase {
  const namedChildren: TSNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child?.isNamed && !SKIP_SUBTREE_TYPES.has(child.type)) {
      namedChildren.push(child);
    }
  }
  let current = base;
  for (let i = 0; i < namedChildren.length; i++) {
    const child = namedChildren[i];
    if (i < namedChildren.length - 1) {
      current = walkForCandidates(child, current, out);
    } else {
      // Terminal child = the real pipe stage; collect without folding.
      tagTokens(collectPathCandidateTokens(child), current, out);
    }
  }
  return current;
}

/**
 * True when the statement at `index` is immediately followed by the background
 * operator (`&`) — distinct from the `&&` / `||` / `;` current-shell separators.
 */
function isBackgrounded(seqNode: TSNode, index: number): boolean {
  const next = seqNode.child(index + 1);
  if (!next || next.isNamed) return false;
  return next.type === "&";
}

function tagTokens(
  tokens: readonly string[],
  base: EffectiveBase,
  out: PathCandidate[],
): void {
  for (const token of tokens) out.push({ token, base });
}

/**
 * True when a path candidate is relative (resolved against the effective
 * directory) rather than absolute (`/…`) or home-relative (`~…`), which are
 * base-independent. Used to decide which candidates an unknown base affects.
 */
function isRelativeCandidate(candidate: string): boolean {
  return !candidate.startsWith("/") && !candidate.startsWith("~");
}

function getPolicyValuesForRuleCandidate(
  candidate: string,
  base: EffectiveBase,
  cwd: string | undefined,
): string[] {
  if (!cwd) {
    const literal = normalizePathPolicyLiteral(candidate);
    return literal ? [literal] : [];
  }

  if (base.kind === "unknown" && isRelativeCandidate(candidate)) {
    const literal = normalizePathPolicyLiteral(candidate);
    return literal ? [literal] : [];
  }

  const resolveBase = base.kind === "known" ? resolve(cwd, base.offset) : cwd;
  return getPathPolicyValues(candidate, { cwd, resolveBase });
}

/**
 * Compute the effective base after a command runs. Returns `base` unchanged
 * unless the command is `cd`:
 *
 * - `cd /abs` (absolute literal) → a fresh known base, recovering from an
 *   earlier unknown base.
 * - `cd rel` (relative literal) → fold into a known base, or stay unknown if the
 *   base was already unknown.
 * - `cd "$DIR"` / `cd $(…)` / `cd -` / bare `cd` / `cd ~…` (non-literal) →
 *   unknown.
 */
function foldCd(commandNode: TSNode, base: EffectiveBase): EffectiveBase {
  if (extractCommandName(commandNode) !== "cd") return base;
  const target = cdLiteralTarget(commandNode);
  if (target === null) return UNKNOWN_BASE;
  if (isAbsolute(target)) return { kind: "known", offset: target };
  if (base.kind === "unknown") return UNKNOWN_BASE;
  return { kind: "known", offset: join(base.offset, target) };
}

/**
 * Resolve the literal target of a `cd` command, or `null` when the first
 * argument is not a static literal (contains an expansion or command
 * substitution) or cannot be resolved against the working directory (`cd -`,
 * `cd ~…`, bare `cd`).
 */
function cdLiteralTarget(commandNode: TSNode): string | null {
  for (let i = 0; i < commandNode.childCount; i++) {
    const child = commandNode.child(i);
    if (!child) continue;
    if (child.type === "command_name" || child.type === "variable_assignment")
      continue;
    if (!child.isNamed) continue;
    // Skip the `--` end-of-flags marker; the next argument is the target.
    if (child.type === "word" && child.text === "--") continue;
    if (!ARG_NODE_TYPES.has(child.type)) return null;
    return literalTextOf(child);
  }
  return null;
}

/**
 * The literal string value of an argument node, or `null` when it contains a
 * variable expansion / command substitution or is a non-resolvable `cd`
 * destination (`-`, `~…`).
 */
function literalTextOf(node: TSNode): string | null {
  switch (node.type) {
    case "word": {
      const text = node.text;
      if (text === "-" || text.startsWith("~")) return null;
      return text;
    }
    case "raw_string": {
      const text = node.text;
      return text.length >= 2 && text.startsWith("'") && text.endsWith("'")
        ? text.slice(1, -1)
        : text;
    }
    case "concatenation": {
      let result = "";
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (!child) continue;
        const part = literalTextOf(child);
        if (part === null) return null;
        result += part;
      }
      return result;
    }
    case "string": {
      let result = "";
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (!child) continue;
        if (child.type === '"') continue;
        if (child.type !== "string_content") return null;
        result += child.text;
      }
      return result;
    }
    default:
      return null;
  }
}
