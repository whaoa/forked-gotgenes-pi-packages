import { describe, expect, it } from "vitest";

import {
  buildDirectUiPrompt,
  buildForwardedUiPrompt,
  buildUiPrompt,
} from "#src/permission-ui-prompt";

describe("buildDirectUiPrompt", () => {
  it("maps a tool_call prompt to the tool surface and command value", () => {
    expect(
      buildDirectUiPrompt({
        requestId: "req-1",
        source: "tool_call",
        agentName: "Explore",
        message: "Allow git push?",
        toolName: "bash",
        command: "git push",
      }),
    ).toEqual({
      requestId: "req-1",
      source: "tool_call",
      surface: "bash",
      value: "git push",
      agentName: "Explore",
      message: "Allow git push?",
      forwarding: null,
    });
  });

  it("normalizes a skill prompt to the skill surface and skill-name value", () => {
    expect(
      buildDirectUiPrompt({
        requestId: "req-2",
        source: "skill_input",
        agentName: null,
        message: "Allow skill?",
        skillName: "deploy-helper",
      }),
    ).toEqual({
      requestId: "req-2",
      source: "skill_input",
      surface: "skill",
      value: "deploy-helper",
      agentName: null,
      message: "Allow skill?",
      forwarding: null,
    });
  });

  it("derives value with command > path > target > skillName > toolName precedence", () => {
    expect(
      buildDirectUiPrompt({
        requestId: "req-3",
        source: "tool_call",
        agentName: null,
        message: "m",
        toolName: "read",
        path: "/etc/hosts",
        target: "ignored",
      }).value,
    ).toBe("/etc/hosts");
  });
});

describe("buildUiPrompt", () => {
  it("derives surface and value from direct fields and defaults forwarding to null", () => {
    expect(
      buildUiPrompt({
        requestId: "req-u1",
        source: "tool_call",
        agentName: "Explore",
        message: "Allow git push?",
        toolName: "bash",
        command: "git push",
      }),
    ).toEqual({
      requestId: "req-u1",
      source: "tool_call",
      surface: "bash",
      value: "git push",
      agentName: "Explore",
      message: "Allow git push?",
      forwarding: null,
    });
  });

  it("uses explicit surface and value overrides in place of the derived projection", () => {
    expect(
      buildUiPrompt({
        requestId: "req-u2",
        source: "tool_call",
        agentName: "Explore",
        message: "m",
        toolName: "bash",
        command: "git push",
        surface: "external_directory",
        value: "/etc/hosts",
      }),
    ).toEqual({
      requestId: "req-u2",
      source: "tool_call",
      surface: "external_directory",
      value: "/etc/hosts",
      agentName: "Explore",
      message: "m",
      forwarding: null,
    });
  });

  it("treats an explicit null surface/value override as intentional, not a fallback trigger", () => {
    expect(
      buildUiPrompt({
        requestId: "req-u3",
        source: "tool_call",
        agentName: null,
        message: "m",
        toolName: "bash",
        command: "git push",
        surface: null,
        value: null,
      }),
    ).toEqual({
      requestId: "req-u3",
      source: "tool_call",
      surface: null,
      value: null,
      agentName: null,
      message: "m",
      forwarding: null,
    });
  });

  it("passes forwarding context through alongside explicit display fields", () => {
    expect(
      buildUiPrompt({
        requestId: "req-u4",
        source: "tool_call",
        agentName: "Explore",
        message: "Subagent 'Explore' requested permission.\n\nAllow git push?",
        surface: "bash",
        value: "git push",
        forwarding: {
          requesterAgentName: "Explore",
          requesterSessionId: "child-session",
        },
      }),
    ).toEqual({
      requestId: "req-u4",
      source: "tool_call",
      surface: "bash",
      value: "git push",
      agentName: "Explore",
      message: "Subagent 'Explore' requested permission.\n\nAllow git push?",
      forwarding: {
        requesterAgentName: "Explore",
        requesterSessionId: "child-session",
      },
    });
  });
});

describe("buildForwardedUiPrompt", () => {
  it("populates forwarding context and carries the original source/surface/value", () => {
    expect(
      buildForwardedUiPrompt({
        requestId: "req-fwd",
        message: "Subagent 'Explore' requested permission.\n\nAllow git push?",
        requesterAgentName: "Explore",
        requesterSessionId: "child-session",
        source: "tool_call",
        surface: "bash",
        value: "git push",
      }),
    ).toEqual({
      requestId: "req-fwd",
      source: "tool_call",
      surface: "bash",
      value: "git push",
      agentName: "Explore",
      message: "Subagent 'Explore' requested permission.\n\nAllow git push?",
      forwarding: {
        requesterAgentName: "Explore",
        requesterSessionId: "child-session",
      },
    });
  });

  it("falls back to source tool_call with null surface/value when the request omits them", () => {
    expect(
      buildForwardedUiPrompt({
        requestId: "req-fwd-old",
        message: "Allow?",
        requesterAgentName: null,
        requesterSessionId: null,
      }),
    ).toEqual({
      requestId: "req-fwd-old",
      source: "tool_call",
      surface: null,
      value: null,
      agentName: null,
      message: "Allow?",
      forwarding: { requesterAgentName: null, requesterSessionId: null },
    });
  });
});
