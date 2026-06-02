import { describe, expect, it, vi } from "vitest";

import { resolveBashCommandCheck } from "#src/handlers/gates/bash-command";
import type { Rule } from "#src/rule";
import type { PermissionCheckResult } from "#src/types";

import { makeCheckResult } from "#test/helpers/handler-fixtures";

type CheckPermissionFn = (
  surface: string,
  input: unknown,
  agentName?: string,
  sessionRules?: Rule[],
) => PermissionCheckResult;

/** Build a bash-surface check result for a single command unit. */
function bashResult(
  state: PermissionCheckResult["state"],
  command: string,
  matchedPattern?: string,
): PermissionCheckResult {
  return makeCheckResult({ state, source: "bash", command, matchedPattern });
}

describe("resolveBashCommandCheck", () => {
  it("passes a single command straight through", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockReturnValue(bashResult("allow", "npm install pkg", "npm *"));

    const result = resolveBashCommandCheck(
      "npm install pkg",
      [{ text: "npm install pkg" }],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("allow");
    expect(checkPermission).toHaveBeenCalledTimes(1);
    expect(checkPermission).toHaveBeenCalledWith(
      "bash",
      { command: "npm install pkg" },
      undefined,
      [],
    );
  });

  it("denies the chain when any sub-command is denied, reporting that command's pattern", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockImplementation((_surface, input) => {
        const command = (input as { command: string }).command;
        return command.startsWith("npm")
          ? bashResult("deny", command, "npm *")
          : bashResult("allow", command, "cd *");
      });

    const result = resolveBashCommandCheck(
      "cd /p && npm install pkg",
      [{ text: "cd /p" }, { text: "npm install pkg" }],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("deny");
    expect(result.matchedPattern).toBe("npm *");
    expect(result.command).toBe("npm install pkg");
  });

  it("asks when a sub-command asks and none denies", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockImplementation((_surface, input) => {
        const command = (input as { command: string }).command;
        return command.startsWith("git")
          ? bashResult("ask", command, "git *")
          : bashResult("allow", command, "cd *");
      });

    const result = resolveBashCommandCheck(
      "cd /p && git push",
      [{ text: "cd /p" }, { text: "git push" }],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("ask");
    expect(result.matchedPattern).toBe("git *");
    expect(result.command).toBe("git push");
  });

  it("returns the first allow result when every sub-command is allowed", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockImplementation((_surface, input) => {
        const command = (input as { command: string }).command;
        return bashResult("allow", command, `${command} *`);
      });

    const result = resolveBashCommandCheck(
      "a && b",
      [{ text: "a" }, { text: "b" }],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("allow");
    expect(result.matchedPattern).toBe("a *");
  });

  it("falls back to the whole command when no top-level commands are found", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockReturnValue(bashResult("ask", "( rm x )", "*"));

    const result = resolveBashCommandCheck(
      "( rm x )",
      [],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("ask");
    expect(result.commandContext).toBeUndefined();
    expect(checkPermission).toHaveBeenCalledTimes(1);
    expect(checkPermission).toHaveBeenCalledWith(
      "bash",
      { command: "( rm x )" },
      undefined,
      [],
    );
  });

  it("forwards the agent name and session rules to each sub-command check", () => {
    const sessionRules: Rule[] = [
      { surface: "bash", pattern: "npm *", action: "allow", origin: "session" },
    ];
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockReturnValue(bashResult("allow", "npm i"));

    resolveBashCommandCheck(
      "npm i",
      [{ text: "npm i" }],
      "agent-x",
      sessionRules,
      checkPermission,
    );

    expect(checkPermission).toHaveBeenCalledWith(
      "bash",
      { command: "npm i" },
      "agent-x",
      sessionRules,
    );
  });

  it("tags the winning result with the offending command's execution context", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockImplementation((_surface, input) => {
        const command = (input as { command: string }).command;
        return command.startsWith("rm")
          ? bashResult("deny", command, "rm *")
          : bashResult("allow", command, "echo *");
      });

    const result = resolveBashCommandCheck(
      "echo $(rm -rf foo)",
      [
        { text: "echo $(rm -rf foo)" },
        { text: "rm -rf foo", context: "command_substitution" },
      ],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("deny");
    expect(result.command).toBe("rm -rf foo");
    expect(result.commandContext).toBe("command_substitution");
  });

  it("leaves commandContext unset when the winning command is top-level", () => {
    const checkPermission = vi
      .fn<CheckPermissionFn>()
      .mockReturnValue(bashResult("deny", "rm -rf foo", "rm *"));

    const result = resolveBashCommandCheck(
      "rm -rf foo",
      [{ text: "rm -rf foo" }],
      undefined,
      [],
      checkPermission,
    );

    expect(result.state).toBe("deny");
    expect(result.commandContext).toBeUndefined();
  });
});
