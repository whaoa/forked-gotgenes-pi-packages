import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubagentSession } from "#src/lifecycle/create-subagent-session";
import { SubagentSession } from "#src/lifecycle/subagent-session";
import { STUB_SNAPSHOT } from "#test/helpers/stub-ctx";
import {
  createAgentLookup,
  createChildLifecycleMock,
  createFactorySession,
  createSubagentSessionDeps,
  createSubagentSessionIO,
} from "#test/helpers/subagent-session-io";

/** Mock AgentConfigLookup. */
const mockAgentLookup = createAgentLookup();

let io: ReturnType<typeof createSubagentSessionIO>;

const exec = vi.fn();

beforeEach(() => {
  io = createSubagentSessionIO();
});

describe("createSubagentSession — assembly", () => {
  let session: ReturnType<typeof createFactorySession>;

  beforeEach(() => {
    session = createFactorySession();
    io.createSession.mockResolvedValue({ session });
  });

  it("returns a born-complete SubagentSession wrapping the created session", async () => {
    const sub = await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(sub).toBeInstanceOf(SubagentSession);
    expect(sub.session).toBe(session);
  });

  it("exposes the persisted session file as outputFile", async () => {
    const sub = await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(sub.outputFile).toBe("/sessions/child.jsonl");
  });

  it("binds extensions before returning", async () => {
    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(session.bindExtensions).toHaveBeenCalledTimes(1);
    expect(session.bindExtensions).toHaveBeenCalledWith({});
  });

  it("passes the effective cwd and agentDir to the loader, settings, and session", async () => {
    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore", cwd: "/tmp/worktree" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(io.getAgentDir).toHaveBeenCalledTimes(1);
    expect(io.createResourceLoader).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/tmp/worktree", agentDir: "/mock/agent-dir" }),
    );
    expect(io.createSettingsManager).toHaveBeenCalledWith("/tmp/worktree", "/mock/agent-dir");
    expect(io.createSessionManager).toHaveBeenCalledWith("/tmp/worktree", "/mock/session-dir/tasks");
    expect(io.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/tmp/worktree", agentDir: "/mock/agent-dir" }),
    );
  });

  it("suppresses AGENTS.md/CLAUDE.md/APPEND_SYSTEM.md for subagents", async () => {
    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(io.createResourceLoader).toHaveBeenCalledWith(
      expect.objectContaining({
        noContextFiles: true,
        appendSystemPromptOverride: expect.any(Function),
      }),
    );
    const loaderOpts = io.createResourceLoader.mock.calls[0][0];
    expect(loaderOpts.appendSystemPromptOverride()).toEqual([]);
  });

  it("calls newSession with parentSession when parentSessionId is provided", async () => {
    await createSubagentSession(
      {
        snapshot: STUB_SNAPSHOT,
        type: "Explore",
        parentSession: { parentSessionFile: "/sessions/parent.jsonl", parentSessionId: "parent-id-123" },
      },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    const sm = io.createSessionManager.mock.results[0].value;
    expect(sm.newSession).toHaveBeenCalledWith({ parentSession: "parent-id-123" });
  });
});

describe("createSubagentSession — lifecycle ordering", () => {
  let session: ReturnType<typeof createFactorySession>;
  let lifecycle: ReturnType<typeof createChildLifecycleMock>;

  beforeEach(() => {
    session = createFactorySession();
    io.createSession.mockResolvedValue({ session });
    lifecycle = createChildLifecycleMock();
  });

  it("emits spawning before session-created", async () => {
    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup, lifecycle }),
    );

    expect(lifecycle.spawning).toHaveBeenCalledOnce();
    const spawnOrder = lifecycle.spawning.mock.invocationCallOrder[0];
    const createdOrder = lifecycle.sessionCreated.mock.invocationCallOrder[0];
    expect(spawnOrder).toBeLessThan(createdOrder);
  });

  it("emits session-created before bindExtensions()", async () => {
    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup, lifecycle }),
    );

    expect(lifecycle.sessionCreated).toHaveBeenCalledOnce();
    const createdOrder = lifecycle.sessionCreated.mock.invocationCallOrder[0];
    const bindOrder = session.bindExtensions.mock.invocationCallOrder[0];
    expect(createdOrder).toBeLessThan(bindOrder);
  });

  it("carries the session id and parent session id in session-created", async () => {
    io.deriveSessionDir.mockReturnValue("/custom/session/dir");

    await createSubagentSession(
      {
        snapshot: STUB_SNAPSHOT,
        type: "Explore",
        parentSession: {
          parentSessionFile: "/sessions/parent.jsonl",
          parentSessionId: "parent-session-42",
        },
      },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup, lifecycle }),
    );

    expect(lifecycle.sessionCreated).toHaveBeenCalledWith({
      sessionId: "child-session-id",
      parentSessionId: "parent-session-42",
    });
  });

  it("does not emit completed or disposed during creation", async () => {
    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup, lifecycle }),
    );

    expect(lifecycle.completed).not.toHaveBeenCalled();
    expect(lifecycle.disposed).not.toHaveBeenCalled();
  });
});

describe("createSubagentSession — dispose on creation failure", () => {
  it("disposes the session and emits disposed when bindExtensions throws, then rethrows", async () => {
    const session = createFactorySession();
    session.bindExtensions = vi.fn().mockRejectedValue(new Error("bind failed"));
    io.createSession.mockResolvedValue({ session });
    io.deriveSessionDir.mockReturnValue("/custom/session/dir");
    const lifecycle = createChildLifecycleMock();

    await expect(
      createSubagentSession(
        { snapshot: STUB_SNAPSHOT, type: "Explore" },
        createSubagentSessionDeps({ io, exec, registry: mockAgentLookup, lifecycle }),
      ),
    ).rejects.toThrow("bind failed");

    // session-created fired, so disposed must fire to avoid a registry leak.
    expect(lifecycle.sessionCreated).toHaveBeenCalledOnce();
    expect(lifecycle.disposed).toHaveBeenCalledOnce();
    expect(lifecycle.disposed).toHaveBeenCalledWith({ sessionId: "child-session-id" });
    expect(session.dispose).toHaveBeenCalledOnce();
  });
});

describe("createSubagentSession — post-bind recursion guard", () => {
  // Extension-registered tools join the active set during bindExtensions; a
  // single post-bind filter pass applies the EXCLUDED_TOOL_NAMES recursion
  // guard to the full post-bind set. The factory session flips getActiveToolNames
  // from its before-bind set to its after-bind set once bindExtensions resolves.

  it("calls setActiveToolsByName once, after bindExtensions", async () => {
    const session = createFactorySession({ toolsBeforeBind: ["read"], toolsAfterBind: ["read", "extension_tool"] });
    io.createSession.mockResolvedValue({ session });

    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(session.setActiveToolsByName).toHaveBeenCalledTimes(1);
    const bindOrder = session.bindExtensions.mock.invocationCallOrder[0];
    const setOrder = session.setActiveToolsByName.mock.invocationCallOrder[0];
    expect(setOrder).toBeGreaterThan(bindOrder);
  });

  it("includes extension-registered tools in the post-bind set", async () => {
    const session = createFactorySession({ toolsBeforeBind: ["read"], toolsAfterBind: ["read", "extension_tool"] });
    io.createSession.mockResolvedValue({ session });

    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    const postBindArgs = session.setActiveToolsByName.mock.calls[0][0];
    expect(postBindArgs).toContain("read");
    expect(postBindArgs).toContain("extension_tool");
  });

  it("excludes EXCLUDED_TOOL_NAMES from the post-bind set", async () => {
    const session = createFactorySession({
      toolsBeforeBind: ["read"],
      toolsAfterBind: ["read", "subagent", "get_subagent_result", "steer_subagent", "external"],
    });
    io.createSession.mockResolvedValue({ session });

    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    const postBindArgs = session.setActiveToolsByName.mock.calls[0][0];
    expect(postBindArgs).toContain("read");
    expect(postBindArgs).toContain("external");
    expect(postBindArgs).not.toContain("subagent");
    expect(postBindArgs).not.toContain("get_subagent_result");
    expect(postBindArgs).not.toContain("steer_subagent");
  });

  it("runs the guard unconditionally even when no extension tools are registered", async () => {
    const session = createFactorySession();
    io.createSession.mockResolvedValue({ session });

    await createSubagentSession(
      { snapshot: STUB_SNAPSHOT, type: "Explore" },
      createSubagentSessionDeps({ io, exec, registry: mockAgentLookup }),
    );

    expect(session.setActiveToolsByName).toHaveBeenCalledTimes(1);
    expect(session.setActiveToolsByName.mock.calls[0][0]).toEqual(["read"]);
  });
});
