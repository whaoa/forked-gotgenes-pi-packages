import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedAccessIntent } from "#src/access-intent/access-intent";
import type { ScopedPermissionManager } from "#src/permission-manager";
import { PermissionResolver } from "#src/permission-resolver";
import type { Ruleset } from "#src/rule";
import { SessionApproval } from "#src/session-approval";
import { SessionRules } from "#src/session-rules";
import type { PermissionCheckResult, PermissionState } from "#src/types";

function makePermissionManager() {
  return {
    configureForCwd: vi.fn<(cwd: string | undefined | null) => void>(),
    check: vi
      .fn<
        (
          intent: ResolvedAccessIntent,
          sessionRules?: Ruleset,
        ) => PermissionCheckResult
      >()
      .mockReturnValue({
        state: "allow",
        toolName: "read",
        source: "tool",
        origin: "builtin",
      }),
    getToolPermission: vi
      .fn<(toolName: string, agentName?: string) => PermissionState>()
      .mockReturnValue("allow"),
    getConfigIssues: vi.fn((): string[] => []),
  };
}

function makeResolver(
  pm?: ScopedPermissionManager,
  sessionRules?: Pick<SessionRules, "getRuleset">,
) {
  const permissionManager = pm ?? makePermissionManager();
  const rules = sessionRules ?? new SessionRules();
  return {
    resolver: new PermissionResolver(permissionManager, rules),
    permissionManager,
  };
}

beforeEach(() => {
  // no module-level vi.fn() stubs to reset
});

describe("PermissionResolver", () => {
  describe("resolve", () => {
    it("forwards surface, input, and agentName as a tool intent with session ruleset", () => {
      const { resolver, permissionManager } = makeResolver();

      resolver.resolve("bash", { command: "ls" }, "agent-x");

      expect(permissionManager.check).toHaveBeenCalledWith(
        {
          kind: "tool",
          surface: "bash",
          input: { command: "ls" },
          agentName: "agent-x",
        },
        [],
      );
    });

    it("defaults agentName to undefined when omitted", () => {
      const { resolver, permissionManager } = makeResolver();

      resolver.resolve("read", { path: ".env" });

      expect(permissionManager.check).toHaveBeenCalledWith(
        {
          kind: "tool",
          surface: "read",
          input: { path: ".env" },
          agentName: undefined,
        },
        [],
      );
    });

    it("applies a recorded session approval on the next resolve", () => {
      const pm = makePermissionManager();
      const sessionRules = new SessionRules();
      const { resolver } = makeResolver(pm, sessionRules);

      // Record an approval directly into the shared SessionRules instance.
      sessionRules.recordSessionApproval(
        SessionApproval.single("bash", "git *"),
      );
      resolver.resolve("bash", { command: "git status" });

      const passedRules = vi.mocked(pm.check).mock.calls[0][1];
      expect(passedRules).toHaveLength(1);
      expect(passedRules?.[0]).toMatchObject({
        surface: "bash",
        pattern: "git *",
        action: "allow",
      });
    });

    it("returns the manager's check result", () => {
      const pm = makePermissionManager();
      vi.mocked(pm.check).mockReturnValue({
        state: "deny",
        toolName: "bash",
        source: "bash",
        origin: "global",
        matchedPattern: "rm *",
      });
      const { resolver } = makeResolver(pm);

      const result = resolver.resolve("bash", { command: "rm -rf /" });

      expect(result).toEqual({
        state: "deny",
        toolName: "bash",
        source: "bash",
        origin: "global",
        matchedPattern: "rm *",
      });
    });
  });

  describe("resolvePathPolicy", () => {
    it("forwards values and agentName as a path-values intent with session ruleset", () => {
      const { resolver, permissionManager } = makeResolver();

      resolver.resolvePathPolicy(["/proj/src/a.ts", "src/a.ts"], "agent-x");

      expect(permissionManager.check).toHaveBeenCalledWith(
        {
          kind: "path-values",
          surface: "path",
          values: ["/proj/src/a.ts", "src/a.ts"],
          agentName: "agent-x",
        },
        [],
      );
    });

    it("forwards an explicit surface in the path-values intent", () => {
      const { resolver, permissionManager } = makeResolver();

      resolver.resolvePathPolicy(["/tmp/x"], "agent-x", "external_directory");

      expect(permissionManager.check).toHaveBeenCalledWith(
        {
          kind: "path-values",
          surface: "external_directory",
          values: ["/tmp/x"],
          agentName: "agent-x",
        },
        [],
      );
    });

    it("applies a recorded session approval on the next call", () => {
      const pm = makePermissionManager();
      const sessionRules = new SessionRules();
      const { resolver } = makeResolver(pm, sessionRules);

      sessionRules.recordSessionApproval(
        SessionApproval.single("path", "src/*"),
      );
      resolver.resolvePathPolicy(["src/a.ts"]);

      const passedRules = vi.mocked(pm.check).mock.calls[0][1];
      expect(passedRules).toHaveLength(1);
      expect(passedRules?.[0]).toMatchObject({
        surface: "path",
        pattern: "src/*",
        action: "allow",
      });
    });

    it("returns the manager's check result", () => {
      const pm = makePermissionManager();
      vi.mocked(pm.check).mockReturnValue({
        state: "deny",
        toolName: "path",
        source: "special",
        origin: "global",
        matchedPattern: "src/*",
      });
      const { resolver } = makeResolver(pm);

      const result = resolver.resolvePathPolicy(["src/a.ts"]);

      expect(result).toEqual({
        state: "deny",
        toolName: "path",
        source: "special",
        origin: "global",
        matchedPattern: "src/*",
      });
    });
  });

  describe("checkPermission (raw, off-interface)", () => {
    it("delegates to manager.check as a tool intent", () => {
      const { resolver, permissionManager } = makeResolver();

      resolver.checkPermission("bash", { command: "ls" }, "agent-1");

      expect(permissionManager.check).toHaveBeenCalledWith(
        {
          kind: "tool",
          surface: "bash",
          input: { command: "ls" },
          agentName: "agent-1",
        },
        undefined,
      );
    });

    it("passes optional sessionRules as the second arg to check", () => {
      const { resolver, permissionManager } = makeResolver();
      const extraRules: Ruleset = [
        { surface: "bash", pattern: "*", action: "allow", origin: "session" },
      ];

      resolver.checkPermission(
        "bash",
        { command: "ls" },
        undefined,
        extraRules,
      );

      expect(permissionManager.check).toHaveBeenCalledWith(
        {
          kind: "tool",
          surface: "bash",
          input: { command: "ls" },
          agentName: undefined,
        },
        extraRules,
      );
    });
  });

  describe("getToolPermission", () => {
    it("delegates to permissionManager.getToolPermission", () => {
      const pm = makePermissionManager();
      vi.mocked(pm.getToolPermission).mockReturnValue("deny");
      const { resolver } = makeResolver(pm);

      const result = resolver.getToolPermission("write", "my-agent");

      expect(pm.getToolPermission).toHaveBeenCalledWith("write", "my-agent");
      expect(result).toBe("deny");
    });
  });

  describe("getConfigIssues", () => {
    it("delegates to permissionManager.getConfigIssues", () => {
      const pm = makePermissionManager();
      vi.mocked(pm.getConfigIssues).mockReturnValue(["issue-1"]);
      const { resolver } = makeResolver(pm);

      const result = resolver.getConfigIssues("agent-1");

      expect(pm.getConfigIssues).toHaveBeenCalledWith("agent-1");
      expect(result).toEqual(["issue-1"]);
    });
  });
});
