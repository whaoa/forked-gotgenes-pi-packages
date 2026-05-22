import { describe, expect, it, vi } from "vitest";
import { type BackgroundParams, spawnBackground } from "../../src/tools/background-spawner.js";
import { AgentActivityTracker } from "../../src/ui/agent-activity-tracker.js";
import { createToolDeps } from "../helpers/make-deps.js";
import { createTestRecord } from "../helpers/make-record.js";

function makeCtx() {
  return {
    sessionManager: {
      getSessionFile: vi.fn().mockReturnValue("/sessions/parent.jsonl"),
      getSessionId: vi.fn().mockReturnValue("session-1"),
    },
  };
}

function makeParams(overrides: Partial<BackgroundParams> = {}): BackgroundParams {
  return {
    ctx: makeCtx(),
    subagentType: "general-purpose",
    prompt: "do something",
    description: "bg task",
    displayName: "General-purpose",
    toolCallId: "tc-1",
    detailBase: {
      displayName: "General-purpose",
      description: "bg task",
      subagentType: "general-purpose",
      modelName: undefined,
      tags: undefined,
    },
    model: undefined,
    effectiveMaxTurns: undefined,
    isolated: undefined,
    inheritContext: undefined,
    thinking: undefined,
    isolation: undefined,
    agentInvocation: {
      modelName: undefined,
      thinking: undefined,
      maxTurns: undefined,
      isolated: undefined,
      inheritContext: undefined,
      runInBackground: true,
      isolation: undefined,
    },
    ...overrides,
  };
}

describe("spawnBackground", () => {
  it("registers an AgentActivityTracker in agentActivity map", () => {
    const deps = createToolDeps();
    spawnBackground(deps, makeParams());
    expect(deps.agentActivity.get("agent-1")).toBeInstanceOf(AgentActivityTracker);
  });

  it("calls widget.ensureTimer and widget.update after spawn", () => {
    const deps = createToolDeps();
    spawnBackground(deps, makeParams());
    expect(deps.widget.ensureTimer).toHaveBeenCalledOnce();
    expect(deps.widget.update).toHaveBeenCalledOnce();
  });

  it("passes toolCallId to manager.spawn so manager wires NotificationState", () => {
    const deps = createToolDeps();
    spawnBackground(deps, makeParams({ toolCallId: "tc-99" }));
    const spawnOpts = (deps.manager.spawn as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(spawnOpts.toolCallId).toBe("tc-99");
  });

  it("returns text result with agent ID and description", () => {
    const deps = createToolDeps();
    const result = spawnBackground(deps, makeParams({ description: "my task" }));
    expect(result.content[0].text).toContain("agent-1");
    expect(result.content[0].text).toContain("my task");
  });

  it("mentions 'queued' in result when record status is queued", () => {
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawn: vi.fn().mockReturnValue("bg-2"),
        getRecord: vi.fn().mockReturnValue(createTestRecord({ status: "queued" })),
        getMaxConcurrent: vi.fn().mockReturnValue(4),
      },
    });
    const result = spawnBackground(deps, makeParams());
    expect(result.content[0].text).toContain("queued");
    expect(result.content[0].text).toContain("max 4 concurrent");
  });

  it("mentions 'started' in result when record is running", () => {
    const deps = createToolDeps();
    const result = spawnBackground(deps, makeParams());
    expect(result.content[0].text).toContain("started");
  });

  it("includes output file path in result when present", () => {
    const record = createTestRecord({ status: "running" });
    record.execution = { session: {} as any, outputFile: "/sessions/bg.jsonl" };
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawn: vi.fn().mockReturnValue("bg-3"),
        getRecord: vi.fn().mockReturnValue(record),
        getMaxConcurrent: vi.fn().mockReturnValue(4),
      },
    });
    const result = spawnBackground(deps, makeParams());
    expect(result.content[0].text).toContain("/sessions/bg.jsonl");
  });

  it("returns error text when manager.spawn throws", () => {
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawn: vi.fn().mockImplementation(() => { throw new Error("spawn failed"); }),
        getRecord: vi.fn(),
        getMaxConcurrent: vi.fn().mockReturnValue(4),
      },
    });
    const result = spawnBackground(deps, makeParams());
    expect(result.content[0].text).toContain("spawn failed");
  });
});
