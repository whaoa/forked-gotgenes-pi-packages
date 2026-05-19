import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetConfig,
  mockGetAgentConfig,
  mockGetToolNamesForType,
  mockGetMemoryToolNames,
  mockGetReadOnlyMemoryToolNames,
  mockBuildAgentPrompt,
  mockBuildMemoryBlock,
  mockBuildReadOnlyMemoryBlock,
  mockPreloadSkills,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(() => ({
    displayName: "Explore",
    description: "Fast codebase exploration agent",
    builtinToolNames: ["read"],
    extensions: false as const,
    skills: false as const,
    promptMode: "replace" as const,
  })),
  mockGetAgentConfig: vi.fn(() => ({
    name: "Explore",
    description: "Fast codebase exploration agent",
    builtinToolNames: ["read"],
    extensions: false as const,
    skills: false as const,
    systemPrompt: "You are Explore.",
    promptMode: "replace" as const,
    inheritContext: false,
    runInBackground: false,
    isolated: false,
  })),
  mockGetToolNamesForType: vi.fn(() => ["read"]),
  mockGetMemoryToolNames: vi.fn(() => []),
  mockGetReadOnlyMemoryToolNames: vi.fn(() => []),
  mockBuildAgentPrompt: vi.fn(() => "assembled system prompt"),
  mockBuildMemoryBlock: vi.fn(() => "memory block"),
  mockBuildReadOnlyMemoryBlock: vi.fn(() => "read-only memory block"),
  mockPreloadSkills: vi.fn(() => []),
}));

vi.mock("../src/agent-types.js", () => ({
  getConfig: mockGetConfig,
  getAgentConfig: mockGetAgentConfig,
  getToolNamesForType: mockGetToolNamesForType,
  getMemoryToolNames: mockGetMemoryToolNames,
  getReadOnlyMemoryToolNames: mockGetReadOnlyMemoryToolNames,
}));

vi.mock("../src/prompts.js", () => ({
  buildAgentPrompt: mockBuildAgentPrompt,
}));

vi.mock("../src/memory.js", () => ({
  buildMemoryBlock: mockBuildMemoryBlock,
  buildReadOnlyMemoryBlock: mockBuildReadOnlyMemoryBlock,
}));

vi.mock("../src/skill-loader.js", () => ({
  preloadSkills: mockPreloadSkills,
}));

import { assembleSessionConfig } from "../src/session-config.js";

const mockEnv = { isGitRepo: false, branch: "", platform: "linux" };

const mockRegistry = {
  find: vi.fn(),
  getAvailable: vi.fn(() => []),
};

const ctx = {
  cwd: "/tmp",
  parentSystemPrompt: "parent prompt",
  modelRegistry: mockRegistry,
};

beforeEach(() => {
  mockGetConfig.mockClear();
  mockGetAgentConfig.mockClear();
  mockGetToolNamesForType.mockClear();
  mockGetMemoryToolNames.mockClear();
  mockGetReadOnlyMemoryToolNames.mockClear();
  mockBuildAgentPrompt.mockClear();
  mockBuildMemoryBlock.mockClear();
  mockBuildReadOnlyMemoryBlock.mockClear();
  mockPreloadSkills.mockClear();
  mockRegistry.find.mockReset();
  mockRegistry.getAvailable.mockClear();
});

describe("assembleSessionConfig — default agent shape", () => {
  it("returns correct shape for Explore agent with defaults", () => {
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.effectiveCwd).toBe("/tmp");
    expect(result.systemPrompt).toBe("assembled system prompt");
    expect(result.toolNames).toEqual(["read"]);
    expect(result.extensions).toBe(false);
    expect(result.noSkills).toBe(true);
    expect(result.disallowedSet).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.thinkingLevel).toBeUndefined();
    expect(result.extras).toEqual({});
  });

  it("uses options.cwd as effectiveCwd when provided", () => {
    const result = assembleSessionConfig("Explore", ctx, { cwd: "/tmp/worktree" }, mockEnv);

    expect(result.effectiveCwd).toBe("/tmp/worktree");
  });

  it("falls back to ctx.cwd when options.cwd is not set", () => {
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.effectiveCwd).toBe("/tmp");
  });

  it("builds disallowedSet from agentConfig.disallowedTools", () => {
    mockGetAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      builtinToolNames: ["read"],
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      disallowedTools: ["write", "bash"],
    });

    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.disallowedSet).toEqual(new Set(["write", "bash"]));
  });

  it("calls buildAgentPrompt with env, cwd, parentSystemPrompt, and extras", () => {
    assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Explore" }),
      "/tmp",
      mockEnv,
      "parent prompt",
      {},
    );
  });

  it("uses effectiveCwd (options.cwd) when calling buildAgentPrompt", () => {
    assembleSessionConfig("Explore", ctx, { cwd: "/tmp/worktree" }, mockEnv);

    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.any(Object),
      "/tmp/worktree",
      expect.any(Object),
      expect.any(String),
      expect.any(Object),
    );
  });
});
