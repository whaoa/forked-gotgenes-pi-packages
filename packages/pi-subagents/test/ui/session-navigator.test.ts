import type { Component, TUI } from "@earendil-works/pi-tui";
import { wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import { AgentTypeRegistry } from "#src/config/agent-types";
import type { SessionMessage } from "#src/types";
import type { NavigableSubagent, TranscriptSource } from "#src/ui/session-navigation";
import { SessionNavigatorHandler, TranscriptOverlay } from "#src/ui/session-navigator";

const registry = new AgentTypeRegistry(() => new Map());

function mockTui(rows = 40, columns = 80): TUI {
  return { terminal: { rows, columns }, requestRender: vi.fn() } as unknown as TUI;
}

function ansiTheme() {
  return {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function fakeSource(overrides: Partial<TranscriptSource> = {}): TranscriptSource {
  return {
    getMessages: () => [{ role: "user", content: "Hello world" }] as unknown as SessionMessage[],
    subscribe: () => () => {},
    streaming: () => undefined,
    ...overrides,
  };
}

function makeOverlay(opts: { source?: TranscriptSource; done?: (r: undefined) => void; tui?: TUI } = {}) {
  return new TranscriptOverlay({
    tui: opts.tui ?? mockTui(),
    theme: ansiTheme(),
    source: opts.source ?? fakeSource(),
    done: opts.done ?? vi.fn(),
    wrapText: wrapTextWithAnsi,
  });
}

function makeNavigable(overrides: Partial<NavigableSubagent> = {}): NavigableSubagent {
  return {
    id: "agent-1",
    type: "general-purpose",
    description: "Test task",
    status: "completed",
    startedAt: 1000,
    completedAt: 4000,
    toolUses: 2,
    activeTools: new Map(),
    responseText: "",
    agentMessages: [],
    isSessionReady: () => true,
    subscribeToUpdates: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe("TranscriptOverlay", () => {
  it("renders the transcript content", () => {
    const lines = makeOverlay().render(80);
    expect(lines.some((l) => l.includes("Hello world"))).toBe(true);
  });

  it("subscribes on construction and requests a render on change", () => {
    const tui = mockTui();
    let captured: (() => void) | undefined;
    const source = fakeSource({
      subscribe: (onChange) => {
        captured = onChange;
        return () => {};
      },
    });
    makeOverlay({ source, tui });
    captured?.();
    expect(tui.requestRender).toHaveBeenCalledOnce();
  });

  it("closes and calls done on Escape", () => {
    const done = vi.fn();
    const overlay = makeOverlay({ done });
    overlay.handleInput("\x1b");
    expect(done).toHaveBeenCalledWith(undefined);
  });

  it("unsubscribes on dispose", () => {
    const unsub = vi.fn();
    const overlay = makeOverlay({ source: fakeSource({ subscribe: () => unsub }) });
    overlay.dispose();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it("does not request a render after dispose", () => {
    const tui = mockTui();
    let captured: (() => void) | undefined;
    const source = fakeSource({
      subscribe: (onChange) => {
        captured = onChange;
        return () => {};
      },
    });
    const overlay = makeOverlay({ source, tui });
    overlay.dispose();
    captured?.();
    expect(tui.requestRender).not.toHaveBeenCalled();
  });
});

describe("SessionNavigatorHandler", () => {
  function makeUI(selectResult?: string) {
    return {
      select: vi.fn().mockResolvedValue(selectResult),
      notify: vi.fn(),
      custom: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("notifies and skips the overlay when no sessions are navigable", async () => {
    const ui = makeUI();
    const notReady = makeNavigable({ isSessionReady: () => false });
    await new SessionNavigatorHandler().handle({ ui, agents: [notReady], registry });
    expect(ui.notify).toHaveBeenCalledWith("No subagent sessions to view.", "info");
    expect(ui.custom).not.toHaveBeenCalled();
  });

  it("does not open the overlay when the operator cancels the picker", async () => {
    const ui = makeUI(undefined);
    await new SessionNavigatorHandler().handle({ ui, agents: [makeNavigable()], registry });
    expect(ui.select).toHaveBeenCalledOnce();
    expect(ui.custom).not.toHaveBeenCalled();
  });

  it("opens a read-only overlay sourced from the picked record", async () => {
    const messages = [{ role: "assistant", content: [{ type: "text", text: "picked agent reply" }] }] as unknown as SessionMessage[];
    const record = makeNavigable({ agentMessages: messages });
    const [label] = (() => {
      // The handler labels entries identically to listNavigableAgents.
      return [
        "Agent (Test task) · 2 tools · completed · 3.0s",
      ];
    })();
    const ui = makeUI(label);

    await new SessionNavigatorHandler().handle({ ui, agents: [record], registry });

    expect(ui.custom).toHaveBeenCalledOnce();
    // Invoke the captured component factory and render to confirm it is sourced from the picked record.
    const factory = ui.custom.mock.calls[0][0] as (
      tui: TUI,
      theme: ReturnType<typeof ansiTheme>,
      kb: unknown,
      done: (r: undefined) => void,
    ) => Component;
    const overlay = factory(mockTui(), ansiTheme(), undefined, vi.fn());
    expect(overlay.render(80).some((l) => l.includes("picked agent reply"))).toBe(true);
  });
});
