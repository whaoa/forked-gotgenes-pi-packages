import type { ScopedPermissionManager } from "./permission-manager";
import type { Rule } from "./rule";
import type { SessionRules } from "./session-rules";
import type { PermissionCheckResult, PermissionState } from "./types";

/**
 * Resolves the effective permission for a surface/input, applying the current
 * session rules internally.
 *
 * Collapses the `checkPermission` + `getSessionRuleset` relay that every gate
 * previously threaded by hand: the ruleset was only ever fetched to be passed
 * straight back into `checkPermission`, so the two are one operation.
 */
export interface ScopedPermissionResolver {
  resolve(
    surface: string,
    input: unknown,
    agentName?: string,
  ): PermissionCheckResult;
}

/**
 * Concrete collaborator that owns the resolution surface.
 *
 * Holds a `ScopedPermissionManager` and a `SessionRules` store, composing
 * them so callers never thread the session ruleset by hand.
 *
 * Constructor deps:
 * - `permissionManager` — the narrow session-scoped permission-checking interface
 * - `sessionRules` — narrowed to `getRuleset` (ISP: the resolver only reads, never records)
 */
export class PermissionResolver implements ScopedPermissionResolver {
  constructor(
    private readonly permissionManager: ScopedPermissionManager,
    private readonly sessionRules: Pick<SessionRules, "getRuleset">,
  ) {}

  /**
   * Resolve the effective permission for a surface/input, applying the current
   * session rules. Composes `checkPermission` with `getRuleset()` so callers
   * never thread the ruleset by hand.
   */
  resolve(
    surface: string,
    input: unknown,
    agentName?: string,
  ): PermissionCheckResult {
    return this.checkPermission(
      surface,
      input,
      agentName,
      this.sessionRules.getRuleset(),
    );
  }

  checkPermission(
    surface: string,
    input: unknown,
    agentName?: string,
    sessionRules?: Rule[],
  ): PermissionCheckResult {
    return this.permissionManager.checkPermission(
      surface,
      input,
      agentName,
      sessionRules,
    );
  }

  // fallow-ignore-next-line unused-class-member
  getToolPermission(toolName: string, agentName?: string): PermissionState {
    return this.permissionManager.getToolPermission(toolName, agentName);
  }

  getConfigIssues(agentName?: string): string[] {
    return this.permissionManager.getConfigIssues(agentName);
  }

  // fallow-ignore-next-line unused-class-member
  getPolicyCacheStamp(agentName?: string): string {
    return this.permissionManager.getPolicyCacheStamp(agentName);
  }
}
