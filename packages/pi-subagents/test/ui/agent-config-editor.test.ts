import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTypeRegistry } from "../../src/agent-types.js";
import type { AgentConfig } from "../../src/types.js";
import { createAgentConfigEditor } from "../../src/ui/agent-config-editor.js";

const testDefaultConfig: AgentConfig = {
  name: "test-agent",
  description: "A test agent",
  systemPrompt: "You are a test agent.",
  promptMode: "replace" as const,
  extensions: true,
  skills: true,
  isDefault: true,
  source: "default" as const,
};

const testCustomConfig: AgentConfig = {
  ...testDefaultConfig,
  isDefault: false,
  source: "project" as const,
};

const testRegistry = new AgentTypeRegistry(() => new Map());

function makeFileOps() {
  return {
    exists: vi.fn((): boolean => false),
    read: vi.fn((): string | undefined => undefined),
    write: vi.fn(),
    remove: vi.fn(),
    ensureDir: vi.fn(),
    findAgentFile: vi.fn((): string | undefined => undefined),
  };
}

function makeDeps() {
  return {
    fileOps: makeFileOps(),
    registry: testRegistry,
    personalAgentsDir: "/home/.pi/agents",
    projectAgentsDir: "/project/.pi/agents",
  };
}

function makeCtx(selectResults: (string | undefined)[] = []) {
  let selectIdx = 0;
  return {
    ui: {
      select: vi.fn().mockImplementation(() => selectResults[selectIdx++]),
      input: vi.fn(),
      confirm: vi.fn(),
      editor: vi.fn(),
      notify: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue(testDefaultConfig);
  vi.spyOn(testRegistry, "resolveType").mockReturnValue("test-agent");
  vi.spyOn(testRegistry, "reload").mockImplementation(() => {});
  vi.spyOn(testRegistry, "getAllTypes").mockReturnValue([]);
});

describe("createAgentConfigEditor", () => {
  describe("showAgentDetail", () => {
    it("notifies warning when agent type is not found", async () => {
      vi.spyOn(testRegistry, "resolveType").mockReturnValue(undefined);
      const deps = makeDeps();
      const ctx = makeCtx();
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "missing-agent");

      expect(ctx.ui.notify).toHaveBeenCalledWith(
        'Agent config not found for "missing-agent".',
        "warning",
      );
    });

    it("returns without action when user selects Back", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue(undefined);
      const ctx = makeCtx(["Back"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(ctx.ui.notify).not.toHaveBeenCalled();
    });

    it("returns without action when user cancels", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue(undefined);
      const ctx = makeCtx([undefined]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(ctx.ui.notify).not.toHaveBeenCalled();
    });

    // ---- Menu option structure ----

    it("shows Eject and Disable for a default agent with no file", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue(undefined);
      const ctx = makeCtx([undefined]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      const options = ctx.ui.select.mock.calls[0][1] as string[];
      expect(options).toEqual(["Eject (export as .md)", "Disable", "Back"]);
    });

    it("shows Edit, Disable, Reset, Delete for a default agent with override file", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      const ctx = makeCtx([undefined]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      const options = ctx.ui.select.mock.calls[0][1] as string[];
      expect(options).toEqual(["Edit", "Disable", "Reset to default", "Delete", "Back"]);
    });

    it("shows Edit, Disable, Delete for a custom agent with file", async () => {
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue(testCustomConfig);
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      const ctx = makeCtx([undefined]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      const options = ctx.ui.select.mock.calls[0][1] as string[];
      expect(options).toEqual(["Edit", "Disable", "Delete", "Back"]);
    });

    it("shows Enable, Edit, Reset, Delete for a disabled default agent with file", async () => {
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue({
        ...testDefaultConfig,
        enabled: false,
      });
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      const ctx = makeCtx([undefined]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      const options = ctx.ui.select.mock.calls[0][1] as string[];
      expect(options).toEqual(["Enable", "Edit", "Reset to default", "Delete", "Back"]);
    });

    it("shows Enable, Edit, Delete for a disabled custom agent with file", async () => {
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue({
        ...testCustomConfig,
        enabled: false,
      });
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      const ctx = makeCtx([undefined]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      const options = ctx.ui.select.mock.calls[0][1] as string[];
      expect(options).toEqual(["Enable", "Edit", "Delete", "Back"]);
    });

    // ---- Edit ----

    it("writes updated content when user edits and saves", async () => {
      const deps = makeDeps();
      const filePath = "/project/.pi/agents/test-agent.md";
      deps.fileOps.findAgentFile.mockReturnValue(filePath);
      deps.fileOps.read.mockReturnValue("original content");
      const ctx = makeCtx(["Edit"]);
      ctx.ui.editor.mockResolvedValue("edited content");
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).toHaveBeenCalledWith(filePath, "edited content");
      expect(testRegistry.reload).toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith(`Updated ${filePath}`, "info");
    });

    it("does not write when editor returns unchanged content", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      deps.fileOps.read.mockReturnValue("same content");
      const ctx = makeCtx(["Edit"]);
      ctx.ui.editor.mockResolvedValue("same content");
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).not.toHaveBeenCalled();
    });

    it("does not write when user cancels editor", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      deps.fileOps.read.mockReturnValue("content");
      const ctx = makeCtx(["Edit"]);
      ctx.ui.editor.mockResolvedValue(undefined);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).not.toHaveBeenCalled();
    });

    // ---- Delete ----

    it("removes file when user confirms delete", async () => {
      const deps = makeDeps();
      const filePath = "/project/.pi/agents/test-agent.md";
      deps.fileOps.findAgentFile.mockReturnValue(filePath);
      const ctx = makeCtx(["Delete"]);
      ctx.ui.confirm.mockResolvedValue(true);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.remove).toHaveBeenCalledWith(filePath);
      expect(testRegistry.reload).toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith(`Deleted ${filePath}`, "info");
    });

    it("does not remove file when user cancels delete", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      const ctx = makeCtx(["Delete"]);
      ctx.ui.confirm.mockResolvedValue(false);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.remove).not.toHaveBeenCalled();
    });

    // ---- Reset to default ----

    it("removes override file when user confirms reset", async () => {
      const deps = makeDeps();
      const filePath = "/project/.pi/agents/test-agent.md";
      deps.fileOps.findAgentFile.mockReturnValue(filePath);
      const ctx = makeCtx(["Reset to default"]);
      ctx.ui.confirm.mockResolvedValue(true);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.remove).toHaveBeenCalledWith(filePath);
      expect(testRegistry.reload).toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith("Restored default test-agent", "info");
    });

    // ---- Eject ----

    it("writes ejected config to project directory", async () => {
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue({
        ...testDefaultConfig,
        builtinToolNames: ["read", "bash"],
      });
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue(undefined);
      const ctx = makeCtx(["Eject (export as .md)", "Project (.pi/agents/)"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/test-agent.md",
        expect.stringContaining("description: A test agent"),
      );
      expect(testRegistry.reload).toHaveBeenCalled();
    });

    it("prompts for overwrite when ejected file already exists", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue(undefined);
      deps.fileOps.exists.mockReturnValue(true);
      const ctx = makeCtx(["Eject (export as .md)", "Project (.pi/agents/)"]);
      ctx.ui.confirm.mockResolvedValue(false);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(ctx.ui.confirm).toHaveBeenCalledWith(
        "Overwrite",
        expect.stringContaining("already exists"),
      );
      expect(deps.fileOps.write).not.toHaveBeenCalled();
    });

    // ---- Disable ----

    it("disables agent by toggling enabled:false in existing file", async () => {
      const deps = makeDeps();
      const filePath = "/project/.pi/agents/test-agent.md";
      deps.fileOps.findAgentFile.mockReturnValue(filePath);
      deps.fileOps.read.mockReturnValue("---\ndescription: test\n---\n\nprompt\n");
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue(testCustomConfig);
      const ctx = makeCtx(["Disable"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        filePath,
        "---\nenabled: false\ndescription: test\n---\n\nprompt\n",
      );
      expect(testRegistry.reload).toHaveBeenCalled();
    });

    it("notifies when agent is already disabled", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue("/project/.pi/agents/test-agent.md");
      deps.fileOps.read.mockReturnValue("---\nenabled: false\ndescription: test\n---\n");
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue(testCustomConfig);
      const ctx = makeCtx(["Disable"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).not.toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith("test-agent is already disabled.", "info");
    });

    it("creates a disable-only file when no agent file exists", async () => {
      const deps = makeDeps();
      deps.fileOps.findAgentFile.mockReturnValue(undefined);
      const ctx = makeCtx(["Eject (export as .md)"]);
      // Override to test disable path for default agent without file
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue(testDefaultConfig);
      const disableCtx = makeCtx(["Disable", "Project (.pi/agents/)"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(disableCtx as any, "test-agent");

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/test-agent.md",
        "---\nenabled: false\n---\n",
      );
    });

    // ---- Enable ----

    it("enables agent by removing enabled:false from file", async () => {
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue({
        ...testCustomConfig,
        enabled: false,
      });
      const deps = makeDeps();
      const filePath = "/project/.pi/agents/test-agent.md";
      deps.fileOps.findAgentFile.mockReturnValue(filePath);
      deps.fileOps.read.mockReturnValue("---\nenabled: false\ndescription: test\n---\n\nprompt\n");
      const ctx = makeCtx(["Enable"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        filePath,
        "---\ndescription: test\n---\n\nprompt\n",
      );
      expect(testRegistry.reload).toHaveBeenCalled();
    });

    it("removes empty override file when enabling", async () => {
      vi.spyOn(testRegistry, "resolveAgentConfig").mockReturnValue({
        ...testDefaultConfig,
        enabled: false,
      });
      const deps = makeDeps();
      const filePath = "/project/.pi/agents/test-agent.md";
      deps.fileOps.findAgentFile.mockReturnValue(filePath);
      deps.fileOps.read.mockReturnValue("---\nenabled: false\n---\n");
      const ctx = makeCtx(["Enable"]);
      const editor = createAgentConfigEditor(deps);

      await editor.showAgentDetail(ctx as any, "test-agent");

      expect(deps.fileOps.remove).toHaveBeenCalledWith(filePath);
      expect(ctx.ui.notify).toHaveBeenCalledWith(
        `Enabled test-agent (removed ${filePath})`,
        "info",
      );
    });
  });
});
