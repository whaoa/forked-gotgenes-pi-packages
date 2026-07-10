import { PATH_BEARING_TOOLS } from "#src/path-surfaces";

/**
 * What a tool invocation accesses — decided once from the tool name at the
 * point an invocation enters the system.
 *
 * This is the single dispatch point that replaces the scattered
 * `toolName === "bash"`/`"mcp"` re-derivation across the extraction consumers
 * (`input-normalizer`, `tool-input-path`, the tool-call gate pipeline, and
 * `permission-manager`'s source derivation). Adding a tool kind means editing
 * {@link classifyToolKind} plus the exhaustive switches the compiler flags —
 * an OCP win over silent `===` comparisons a new variant sails past (#561).
 *
 * The value is plain data (a string union): `tool-kind.ts` imports no
 * `AccessPath`, so `permission-manager.ts` may consume it without breaching the
 * string boundary formalized in ADR-0002
 * (`docs/decisions/0002-path-values-string-boundary.md`).
 *
 * - `bash` — its own token-based path gates; extraction product is the command.
 * - `mcp` — extraction product is the qualified target.
 * - `skill` — a distinct surface `normalizeInput`/`deriveSource` treat specially.
 * - `path` — a path-bearing built-in (`read`/`write`/`edit`/`grep`/`find`/`ls`);
 *   extraction product is `input.path`.
 * - `extension` — every other tool, plus the `external_directory`/`path` special
 *   surfaces that reach `deriveSource` as normalized names.
 */
export type ToolKind = "bash" | "mcp" | "skill" | "path" | "extension";

/** Classify a tool name into its {@link ToolKind}. */
export function classifyToolKind(toolName: string): ToolKind {
  const name = toolName.trim();
  if (name === "bash") return "bash";
  if (name === "mcp") return "mcp";
  if (name === "skill") return "skill";
  if (PATH_BEARING_TOOLS.has(name)) return "path";
  return "extension";
}
