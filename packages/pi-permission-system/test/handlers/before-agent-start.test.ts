import { describe, expect, it, vi } from "vitest";

import type { AgentPrepSession } from "#src/agent-prep-session";
import {
  AgentPrepHandler,
  shouldExposeTool,
} from "#src/handlers/before-agent-start";
import type { ToolRegistry } from "#src/tool-registry";

import { makeCheckResult, makeCtx } from "#test/helpers/handler-fixtures";

// ── SDK stubs ──────────────────────────────────────────────────────────────
vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
  return {
    ...original,
    isToolCallEventType: vi.fn().mockReturnValue(false),
  };
});

// ── helpers ────────────────────────────────────────────────────────────────

function makeEvent(systemPrompt = "You are an assistant.") {
  return { systemPrompt };
}

function makeSession(
  overrides: Partial<AgentPrepSession> = {},
): AgentPrepSession {
  return {
    activate: overrides.activate ?? vi.fn<AgentPrepSession["activate"]>(),
    refreshConfig:
      overrides.refreshConfig ?? vi.fn<AgentPrepSession["refreshConfig"]>(),
    resolveAgentName:
      overrides.resolveAgentName ??
      vi.fn<AgentPrepSession["resolveAgentName"]>().mockReturnValue(null),
    checkPermission:
      overrides.checkPermission ??
      vi
        .fn<AgentPrepSession["checkPermission"]>()
        .mockReturnValue(makeCheckResult()),
    getToolPermission:
      overrides.getToolPermission ??
      vi.fn<AgentPrepSession["getToolPermission"]>().mockReturnValue("allow"),
    shouldUpdateActiveTools:
      overrides.shouldUpdateActiveTools ??
      vi
        .fn<AgentPrepSession["shouldUpdateActiveTools"]>()
        .mockReturnValue(true),
    commitActiveToolsCacheKey:
      overrides.commitActiveToolsCacheKey ??
      vi.fn<AgentPrepSession["commitActiveToolsCacheKey"]>(),
    getPolicyCacheStamp:
      overrides.getPolicyCacheStamp ??
      vi
        .fn<AgentPrepSession["getPolicyCacheStamp"]>()
        .mockReturnValue("stamp-1"),
    shouldUpdatePromptState:
      overrides.shouldUpdatePromptState ??
      vi
        .fn<AgentPrepSession["shouldUpdatePromptState"]>()
        .mockReturnValue(true),
    commitPromptStateCacheKey:
      overrides.commitPromptStateCacheKey ??
      vi.fn<AgentPrepSession["commitPromptStateCacheKey"]>(),
    setActiveSkillEntries:
      overrides.setActiveSkillEntries ??
      vi.fn<AgentPrepSession["setActiveSkillEntries"]>(),
  };
}

function makeToolRegistry(overrides: Partial<ToolRegistry> = {}): ToolRegistry {
  return {
    getAll: vi.fn().mockReturnValue([]),
    setActive: vi.fn(),
    ...overrides,
  };
}

function makeHandler(overrides?: {
  session?: Partial<AgentPrepSession>;
  toolRegistry?: Partial<ToolRegistry>;
}): {
  handler: AgentPrepHandler;
  session: AgentPrepSession;
  toolRegistry: ToolRegistry;
} {
  const session = makeSession(overrides?.session);
  const toolRegistry = makeToolRegistry(overrides?.toolRegistry);
  const handler = new AgentPrepHandler(session, toolRegistry);
  return { handler, session, toolRegistry };
}

// ── shouldExposeTool (pure helper) ─────────────────────────────────────────

describe("shouldExposeTool", () => {
  it("returns true when tool permission is allow", () => {
    const getter = vi.fn().mockReturnValue("allow");
    expect(shouldExposeTool("read", null, getter)).toBe(true);
  });

  it("returns true when tool permission is ask", () => {
    const getter = vi.fn().mockReturnValue("ask");
    expect(shouldExposeTool("bash", "agent-x", getter)).toBe(true);
  });

  it("returns false when tool permission is deny", () => {
    const getter = vi.fn().mockReturnValue("deny");
    expect(shouldExposeTool("write", null, getter)).toBe(false);
  });

  it("passes agentName through to getToolPermission", () => {
    const getter = vi.fn().mockReturnValue("allow");
    shouldExposeTool("read", "my-agent", getter);
    expect(getter).toHaveBeenCalledWith("read", "my-agent");
  });

  it("converts null agentName to undefined for getToolPermission", () => {
    const getter = vi.fn().mockReturnValue("allow");
    shouldExposeTool("read", null, getter);
    expect(getter).toHaveBeenCalledWith("read", undefined);
  });
});

// ── AgentPrepHandler.handle ────────────────────────────────────────────────

describe("AgentPrepHandler.handle", () => {
  it("activates the session with ctx", async () => {
    const ctx = makeCtx();
    const { handler, session } = makeHandler();
    await handler.handle(makeEvent(), ctx);
    expect(session.activate).toHaveBeenCalledWith(ctx);
  });

  it("refreshes config with ctx", async () => {
    const ctx = makeCtx();
    const { handler, session } = makeHandler();
    await handler.handle(makeEvent(), ctx);
    expect(session.refreshConfig).toHaveBeenCalledWith(ctx);
  });

  it("resolves agent name using systemPrompt", async () => {
    const ctx = makeCtx();
    const { handler, session } = makeHandler();
    await handler.handle(makeEvent("<active_agent name='x'>"), ctx);
    expect(session.resolveAgentName).toHaveBeenCalledWith(
      ctx,
      "<active_agent name='x'>",
    );
  });

  it("filters out denied tools from allowed list", async () => {
    const { handler, toolRegistry } = makeHandler({
      session: { getToolPermission: vi.fn().mockReturnValue("deny") },
      toolRegistry: {
        getAll: vi.fn().mockReturnValue([{ name: "write" }, { name: "read" }]),
      },
    });
    await handler.handle(makeEvent(), makeCtx());
    expect(toolRegistry.setActive).toHaveBeenCalledWith([]);
  });

  it("includes allowed and ask tools in the active list", async () => {
    const { handler, toolRegistry } = makeHandler({
      toolRegistry: {
        getAll: vi.fn().mockReturnValue([{ name: "read" }, { name: "write" }]),
      },
    });
    await handler.handle(makeEvent(), makeCtx());
    expect(toolRegistry.setActive).toHaveBeenCalledWith(["read", "write"]);
  });

  it("commits active-tools cache key after applying", async () => {
    const { handler, session } = makeHandler({
      toolRegistry: {
        getAll: vi.fn().mockReturnValue([{ name: "read" }]),
      },
    });
    await handler.handle(makeEvent(), makeCtx());
    expect(session.commitActiveToolsCacheKey).toHaveBeenCalled();
  });

  it("skips setActive when cache key is unchanged", async () => {
    const { handler, session, toolRegistry } = makeHandler({
      session: { shouldUpdateActiveTools: vi.fn().mockReturnValue(false) },
      toolRegistry: {
        getAll: vi.fn().mockReturnValue([{ name: "read" }]),
      },
    });
    await handler.handle(makeEvent(), makeCtx());
    expect(toolRegistry.setActive).not.toHaveBeenCalled();
    expect(session.commitActiveToolsCacheKey).not.toHaveBeenCalled();
  });

  it("returns empty object when prompt cache is unchanged", async () => {
    const { handler, session } = makeHandler({
      session: { shouldUpdatePromptState: vi.fn().mockReturnValue(false) },
    });
    const result = await handler.handle(makeEvent(), makeCtx());
    expect(result).toEqual({});
    expect(session.commitPromptStateCacheKey).not.toHaveBeenCalled();
  });

  it("commits prompt-state cache key and processes prompt when cache is new", async () => {
    const { handler, session } = makeHandler();
    await handler.handle(makeEvent(), makeCtx());
    expect(session.commitPromptStateCacheKey).toHaveBeenCalled();
  });

  it("stores resolved skill entries on the session", async () => {
    const { handler, session } = makeHandler();
    await handler.handle(makeEvent(), makeCtx());
    expect(session.setActiveSkillEntries).toHaveBeenCalledWith(
      expect.any(Array),
    );
  });

  it("returns modified systemPrompt when prompt changes", async () => {
    const systemPrompt = `You are an assistant.\n\nAvailable tools:\n- read\n- write\n`;
    const { handler } = makeHandler();
    const result = await handler.handle(makeEvent(systemPrompt), makeCtx());
    expect(result).toHaveProperty("systemPrompt");
  });

  it("returns empty object when systemPrompt is unchanged", async () => {
    const prompt = "No tools section here.";
    const { handler } = makeHandler();
    const result = await handler.handle(makeEvent(prompt), makeCtx());
    expect(result).toEqual({});
  });
});
