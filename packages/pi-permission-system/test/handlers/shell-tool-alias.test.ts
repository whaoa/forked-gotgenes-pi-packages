/**
 * Integration tests for shell-tool aliasing (#574): an aliased shell tool
 * (e.g. `exec_command`) is gated through the real bash enforcement stack at
 * parity with native `bash` — command decomposition and `bash:` rules — using
 * a real `BashProgram` parse driven by the `shellTools` config.
 */
import { describe, expect, it } from "vitest";

import {
  getDecisionEvents,
  makeBashCommandCheck,
  makeCtx,
  makeHandler,
  makeSurfaceCheck,
  makeToolCallEvent,
} from "#test/helpers/handler-fixtures";

const execShellTools = {
  exec_command: { commandArgument: "cmd", workdirArgument: "workdir" },
};

describe("shell-tool alias gating (#574)", () => {
  it("denies an aliased command that a bash: rule denies", async () => {
    const { handler, events } = makeHandler({
      shellTools: execShellTools,
      tools: ["exec_command"],
      session: {
        checkPermission: makeBashCommandCheck({
          deny: /npm/,
          denyMatched: "npm *",
        }),
      },
    });

    await handler.handleToolCall(
      makeToolCallEvent("exec_command", { input: { cmd: "npm install" } }),
      makeCtx(),
    );

    const decisions = getDecisionEvents(events);
    expect(decisions).toContainEqual(
      expect.objectContaining({
        surface: "bash",
        value: "npm install",
        result: "deny",
        resolution: "policy_deny",
      }),
    );
  });

  it("allows an aliased command that no bash: rule denies", async () => {
    const { handler, events } = makeHandler({
      shellTools: execShellTools,
      tools: ["exec_command"],
      session: {
        checkPermission: makeBashCommandCheck({
          deny: /rm -rf/,
          denyMatched: "rm -rf *",
        }),
      },
    });

    await handler.handleToolCall(
      makeToolCallEvent("exec_command", { input: { cmd: "git status" } }),
      makeCtx(),
    );

    const decisions = getDecisionEvents(events);
    expect(decisions).not.toContainEqual(
      expect.objectContaining({ result: "deny" }),
    );
  });

  it("decomposes a chained aliased command so a denied sub-command still blocks", async () => {
    const { handler, events } = makeHandler({
      shellTools: execShellTools,
      tools: ["exec_command"],
      session: {
        checkPermission: makeBashCommandCheck({
          deny: /npm/,
          denyMatched: "npm *",
        }),
      },
    });

    // The whole chain leads with an allowed command; decomposition is what
    // surfaces the denied `npm install` sub-command (#301 parity).
    await handler.handleToolCall(
      makeToolCallEvent("exec_command", {
        input: { cmd: "echo ok && npm install" },
      }),
      makeCtx(),
    );

    const decisions = getDecisionEvents(events);
    expect(decisions).toContainEqual(
      expect.objectContaining({
        surface: "bash",
        result: "deny",
        resolution: "policy_deny",
      }),
    );
  });

  it("gates an aliased tool's workdir and its relative tokens via external_directory", async () => {
    const { handler, events } = makeHandler({
      shellTools: execShellTools,
      tools: ["exec_command"],
      session: {
        checkPermission: makeSurfaceCheck(
          { external_directory: { state: "deny", matchedPattern: "*" } },
          { state: "allow" },
        ),
      },
    });

    // workdir /etc is outside the cwd; the relative token resolves against it.
    await handler.handleToolCall(
      makeToolCallEvent("exec_command", {
        input: { cmd: "cat ../secret.txt", workdir: "/etc" },
      }),
      makeCtx(),
    );

    const decisions = getDecisionEvents(events);
    expect(decisions).toContainEqual(
      expect.objectContaining({
        surface: "external_directory",
        result: "deny",
        resolution: "policy_deny",
      }),
    );
  });

  it("does not treat the tool as a shell when no alias is configured", async () => {
    const { handler, events } = makeHandler({
      // no shellTools — exec_command is a generic extension tool
      tools: ["exec_command"],
      session: {
        checkPermission: makeBashCommandCheck({
          deny: /npm/,
          denyMatched: "npm *",
        }),
      },
    });

    await handler.handleToolCall(
      makeToolCallEvent("exec_command", { input: { cmd: "npm install" } }),
      makeCtx(),
    );

    // The bash rule never sees the command; the tool resolves on its own
    // surface (not `bash`) and is allowed by default.
    const decisions = getDecisionEvents(events);
    expect(decisions).not.toContainEqual(
      expect.objectContaining({ surface: "bash" }),
    );
    expect(decisions).toContainEqual(
      expect.objectContaining({ surface: "exec_command", result: "allow" }),
    );
  });
});
