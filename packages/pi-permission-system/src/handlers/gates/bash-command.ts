import { pickMostRestrictive } from "#src/handlers/gates/candidate-check";
import type { Rule } from "#src/rule";
import type { PermissionCheckResult } from "#src/types";

/** Function type for checkPermission used by the resolver. */
type CheckPermissionFn = (
  surface: string,
  input: unknown,
  agentName?: string,
  sessionRules?: Rule[],
) => PermissionCheckResult;

/**
 * Resolve the bash command-pattern decision for a (possibly chained) command.
 *
 * A bash invocation may be a shell program with several commands joined by
 * `&&`, `||`, `;`, `|`, `&`, or newlines. Matching the whole string against the
 * bash patterns lets a denied command ride through on an allowed leading one
 * (issue #301). Instead, the caller supplies the program's top-level command
 * `units` (from the shared `BashProgram.commands()` parse); each is evaluated on
 * the `bash` surface and the most restrictive result wins (`deny > ask > allow`).
 *
 * The selected result carries the offending sub-command in `command` and its
 * rule in `matchedPattern`, so the prompt, session-approval suggestion, and
 * decision event scope to that command.
 *
 * When `units` is empty (an empty command, a comment, or a bare compound
 * statement), the whole `command` is evaluated as before, so the surface is
 * never weaker than the previous behavior.
 *
 * Pure and synchronous: the (async, tree-sitter) parse happens once in the
 * handler, which passes the decomposed `units` here.
 */
export function resolveBashCommandCheck(
  command: string,
  units: string[],
  agentName: string | undefined,
  sessionRules: Rule[],
  checkPermission: CheckPermissionFn,
): PermissionCheckResult {
  const results = units.map((unit) =>
    checkPermission("bash", { command: unit }, agentName, sessionRules),
  );
  return (
    pickMostRestrictive(results) ??
    checkPermission("bash", { command }, agentName, sessionRules)
  );
}
