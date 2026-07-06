import type {
  DenyWithReason,
  FlatPermissionConfig,
  PatternValue,
  PermissionState,
} from "./config-schema";
import type { RuleOrigin } from "./rule";

// The config-file shape types are derived from the zod schema
// (config-schema.ts) — the single source of truth — and re-exported here so
// existing importers keep their import path.
export type {
  DenyWithReason,
  FlatPermissionConfig,
  PatternValue,
  PermissionState,
  RuleOrigin,
};

/**
 * Predicate deciding whether a bare bash token should be promoted into the
 * `path` rule-candidate surface.
 *
 * Built by `PermissionManager.getPromotablePathTokenMatcher` from the
 * composed config ruleset (specific, non-`*` `path` deny/ask patterns) and
 * threaded through to `BashPathResolver` so promotion policy stays in the
 * manager while the bash layer only asks the predicate.
 */
export type PathRuleTokenMatcher = (token: string) => boolean;

/**
 * Per-scope permission config shape after loading and validation.
 * Holds only the flat permission map — all policy is expressed there.
 */
export interface ScopeConfig {
  permission?: FlatPermissionConfig;
}

/**
 * Execution context of a bash command nested inside a substitution or subshell.
 * Absent for current-shell (top-level) commands.
 */
export type BashCommandContext =
  | "command_substitution"
  | "process_substitution"
  | "subshell";

export interface PermissionCheckResult {
  toolName: string;
  state: PermissionState;
  /** Custom denial reason from a deny-with-reason pattern, when present. */
  reason?: string;
  matchedPattern?: string;
  command?: string;
  target?: string;
  source: "tool" | "bash" | "mcp" | "skill" | "special" | "default" | "session";
  /** Which source contributed the winning rule. */
  origin: RuleOrigin;
  /**
   * Execution context of the offending nested command, when the winning bash
   * unit came from a substitution or subshell. Absent for current-shell
   * (top-level) commands.
   */
  commandContext?: BashCommandContext;
}
