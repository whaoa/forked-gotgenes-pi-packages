import type { AccessPath } from "#src/access-intent/access-path";

/**
 * Raw tool input the manager must normalize (path / bash / MCP / extension tools).
 *
 * The `surface` is the tool name fed to `normalizeInput` (e.g. `"read"`, `"bash"`,
 * an MCP server name).
 */
export interface ToolAccessIntent {
  kind: "tool";
  /** Tool name fed to input normalization. */
  surface: string;
  input: unknown;
  agentName?: string;
}

/**
 * Precomputed equivalent policy values for a path-shaped surface.
 *
 * Used by the bash-path gate (`path` surface), whose cd-resolved lexical
 * `string[]` carry no canonical-boundary notion.
 */
export interface PathValuesAccessIntent {
  kind: "path-values";
  /** `"path"` or `"external_directory"`. */
  surface: string;
  values: readonly string[];
  agentName?: string;
}

/**
 * An `AccessPath` value object for a path-shaped surface.
 *
 * Used by the external-directory gates; lets `AccessPath` flow into the
 * resolver as a first-class variant so the resolver — not the gate — asks it
 * for `matchValues()` (Tell-Don't-Ask).
 */
export interface AccessPathAccessIntent {
  kind: "access-path";
  surface: string;
  path: AccessPath;
  agentName?: string;
}

/** What a gate emits — the full three-variant union. */
export type AccessIntent =
  | ToolAccessIntent
  | PathValuesAccessIntent
  | AccessPathAccessIntent;

/**
 * What the manager consumes — the `access-path` variant has already been
 * unwrapped to `path-values` by the resolver via `path.matchValues()`.
 *
 * The manager stays string-based and never imports `AccessPath`.
 */
export type ResolvedAccessIntent = ToolAccessIntent | PathValuesAccessIntent;
