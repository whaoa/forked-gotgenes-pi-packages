import { BashProgram } from "#src/handlers/gates/bash-program";
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

/** Decompose a bash command into its top-level simple-commands. */
async function decomposeTopLevelCommands(command: string): Promise<string[]> {
  return (await BashProgram.parse(command)).topLevelCommands();
}

/**
 * Resolve the bash command-pattern decision for a (possibly chained) command.
 *
 * A bash invocation may be a shell program with several commands joined by
 * `&&`, `||`, `;`, `|`, `&`, or newlines. Matching the whole string against the
 * bash patterns lets a denied command ride through on an allowed leading one
 * (issue #301). Instead, decompose the command into its top-level simple-commands
 * and evaluate each on the `bash` surface, then select the most restrictive
 * result (`deny > ask > allow`).
 *
 * The selected result carries the offending sub-command in `command` and its
 * rule in `matchedPattern`, so the prompt, session-approval suggestion, and
 * decision event scope to that command.
 *
 * When decomposition yields no top-level commands (an empty command, a comment,
 * or a bare compound statement), the whole command is evaluated as before, so
 * the surface is never weaker than the previous behavior.
 *
 * `checkPermission` stays synchronous and single-command; only the decomposition
 * is async (tree-sitter). `decompose` is injectable for testing.
 */
export async function resolveBashCommandCheck(
  command: string,
  agentName: string | undefined,
  sessionRules: Rule[],
  checkPermission: CheckPermissionFn,
  decompose: (command: string) => Promise<string[]> = decomposeTopLevelCommands,
): Promise<PermissionCheckResult> {
  const units = await decompose(command);
  const results = units.map((unit) =>
    checkPermission("bash", { command: unit }, agentName, sessionRules),
  );
  return (
    pickMostRestrictive(results) ??
    checkPermission("bash", { command }, agentName, sessionRules)
  );
}
