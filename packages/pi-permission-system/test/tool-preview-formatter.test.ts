import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock logging collaborator before importing the module under test.
vi.mock("../src/logging.js", () => ({
  safeJsonStringify: vi.fn((value: unknown) => JSON.stringify(value)),
}));

import { safeJsonStringify } from "#src/logging";
import {
  TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH,
  TOOL_INPUT_PREVIEW_MAX_LENGTH,
  TOOL_TEXT_SUMMARY_MAX_LENGTH,
} from "#src/tool-input-preview";
import {
  ToolPreviewFormatter,
  type ToolPreviewFormatterOptions,
} from "#src/tool-preview-formatter";
import type { PermissionCheckResult } from "#src/types";

const mockedStringify = vi.mocked(safeJsonStringify);

function makeFormatter(
  overrides: Partial<ToolPreviewFormatterOptions> = {},
): ToolPreviewFormatter {
  return new ToolPreviewFormatter({
    toolInputPreviewMaxLength: TOOL_INPUT_PREVIEW_MAX_LENGTH,
    toolTextSummaryMaxLength: TOOL_TEXT_SUMMARY_MAX_LENGTH,
    toolInputLogPreviewMaxLength: TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH,
    ...overrides,
  });
}

function makeResult(
  toolName: string,
  overrides: Partial<PermissionCheckResult> = {},
): PermissionCheckResult {
  return {
    toolName,
    state: "allow",
    source: "tool",
    origin: "builtin",
    ...overrides,
  };
}

beforeEach(() => {
  mockedStringify.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── sanitizeInlineText ────────────────────────────────────────────────────

describe("ToolPreviewFormatter.sanitizeInlineText", () => {
  test("collapses whitespace and trims", () => {
    const f = makeFormatter();
    expect(f.sanitizeInlineText("  hello   world  ")).toBe("hello world");
  });

  test("returns 'empty text' for blank string", () => {
    const f = makeFormatter();
    expect(f.sanitizeInlineText("")).toBe("empty text");
    expect(f.sanitizeInlineText("   ")).toBe("empty text");
  });

  test("truncates at constructor toolTextSummaryMaxLength", () => {
    const f = makeFormatter({ toolTextSummaryMaxLength: 5 });
    const result = f.sanitizeInlineText("hello world");
    expect(result).toBe("hello…");
  });

  test("explicit maxLength override takes precedence over constructor default", () => {
    const f = makeFormatter({ toolTextSummaryMaxLength: 80 });
    const result = f.sanitizeInlineText("hello world", 5);
    expect(result).toBe("hello…");
  });
});

// ── formatJsonInputForPrompt ──────────────────────────────────────────────

describe("ToolPreviewFormatter.formatJsonInputForPrompt", () => {
  test("returns empty string when serialization yields empty", () => {
    mockedStringify.mockReturnValue(undefined);
    const f = makeFormatter();
    expect(f.formatJsonInputForPrompt({})).toBe("");
  });

  test("returns prefixed JSON with 'with input' prefix", () => {
    mockedStringify.mockReturnValue('{"k":"v"}');
    const f = makeFormatter();
    expect(f.formatJsonInputForPrompt({ k: "v" })).toBe('with input {"k":"v"}');
  });

  test("truncates at constructor toolInputPreviewMaxLength", () => {
    const longJson = `"${"x".repeat(20)}"`;
    mockedStringify.mockReturnValue(longJson);
    const f = makeFormatter({ toolInputPreviewMaxLength: 10 });
    const result = f.formatJsonInputForPrompt({});
    // "with input " + 10 chars + ellipsis
    const preview = result.slice("with input ".length);
    expect(preview.length).toBe(11); // 10 + 1 for "…"
    expect(preview.endsWith("…")).toBe(true);
  });

  test("does not truncate when within toolInputPreviewMaxLength", () => {
    mockedStringify.mockReturnValue('{"k":"v"}');
    const f = makeFormatter({ toolInputPreviewMaxLength: 200 });
    expect(f.formatJsonInputForPrompt({ k: "v" })).toBe('with input {"k":"v"}');
  });
});

// ── formatSearchInputForPrompt ────────────────────────────────────────────

describe("ToolPreviewFormatter.formatSearchInputForPrompt", () => {
  test("includes pattern and path", () => {
    const f = makeFormatter();
    const result = f.formatSearchInputForPrompt("grep", {
      pattern: "TODO",
      path: "/src",
    });
    expect(result).toContain("pattern 'TODO'");
    expect(result).toContain("path '/src'");
  });

  test("truncates pattern at toolTextSummaryMaxLength", () => {
    const f = makeFormatter({ toolTextSummaryMaxLength: 5 });
    const result = f.formatSearchInputForPrompt("grep", {
      pattern: "abcdefgh",
    });
    expect(result).toContain("abcde…");
  });

  test("uses 'current working directory' for find/grep/ls without path", () => {
    const f = makeFormatter();
    for (const toolName of ["find", "grep", "ls"]) {
      const result = f.formatSearchInputForPrompt(toolName, {});
      expect(result).toContain("current working directory");
    }
  });

  test("returns empty string for unknown tool with no input", () => {
    const f = makeFormatter();
    expect(f.formatSearchInputForPrompt("other", {})).toBe("");
  });
});

// ── formatToolInputForPrompt ──────────────────────────────────────────────

describe("ToolPreviewFormatter.formatToolInputForPrompt", () => {
  test("dispatches 'edit' to standalone formatEditInputForPrompt", () => {
    mockedStringify.mockReturnValue(undefined);
    const f = makeFormatter();
    const result = f.formatToolInputForPrompt("edit", {
      path: "/foo.ts",
      edits: [],
    });
    expect(result).toContain("for '/foo.ts'");
  });

  test("dispatches 'write' to standalone formatWriteInputForPrompt", () => {
    const f = makeFormatter();
    const result = f.formatToolInputForPrompt("write", {
      path: "/out.ts",
      content: "hi",
    });
    expect(result).toContain("for '/out.ts'");
  });

  test("dispatches 'read' to standalone formatReadInputForPrompt", () => {
    const f = makeFormatter();
    const result = f.formatToolInputForPrompt("read", { path: "/src/x.ts" });
    expect(result).toContain("path '/src/x.ts'");
  });

  test("dispatches 'find'/'grep'/'ls' to formatSearchInputForPrompt", () => {
    const f = makeFormatter();
    for (const tool of ["find", "grep", "ls"]) {
      const result = f.formatToolInputForPrompt(tool, {});
      expect(result).toContain("current working directory");
    }
  });

  test("falls back to formatJsonInputForPrompt for unknown tools", () => {
    mockedStringify.mockReturnValue('{"x":1}');
    const f = makeFormatter();
    const result = f.formatToolInputForPrompt("unknown", { x: 1 });
    expect(result).toContain('{"x":1}');
  });

  test("unknown tool truncates at constructor toolInputPreviewMaxLength", () => {
    const longJson = `{"k":"${"x".repeat(50)}"}`;
    mockedStringify.mockReturnValue(longJson);
    const f = makeFormatter({ toolInputPreviewMaxLength: 10 });
    const result = f.formatToolInputForPrompt("custom", {});
    const preview = result.slice("with input ".length);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBe(11); // 10 + "…"
  });
});

// ── formatGenericToolInputForLog ──────────────────────────────────────────

describe("ToolPreviewFormatter.formatGenericToolInputForLog", () => {
  test("returns undefined when serialization yields empty string", () => {
    mockedStringify.mockReturnValue(undefined);
    const f = makeFormatter();
    expect(f.formatGenericToolInputForLog({})).toBeUndefined();
  });

  test("returns prefixed input preview", () => {
    mockedStringify.mockReturnValue('{"k":"v"}');
    const f = makeFormatter();
    expect(f.formatGenericToolInputForLog({ k: "v" })).toBe('input {"k":"v"}');
  });

  test("truncates at constructor toolInputLogPreviewMaxLength", () => {
    const longJson = `{"k":"${"x".repeat(50)}"}`;
    mockedStringify.mockReturnValue(longJson);
    const f = makeFormatter({ toolInputLogPreviewMaxLength: 10 });
    const result = f.formatGenericToolInputForLog({});
    expect(result).toBeDefined();
    const preview = result!.slice("input ".length);
    expect(preview.length).toBe(11); // 10 + "…"
    expect(preview.endsWith("…")).toBe(true);
  });
});

// ── getToolInputPreviewForLog ─────────────────────────────────────────────

describe("ToolPreviewFormatter.getToolInputPreviewForLog", () => {
  const pathBearingTools = new Set(["read", "write", "edit"]);

  test("returns undefined for bash tool", () => {
    const f = makeFormatter();
    expect(
      f.getToolInputPreviewForLog(
        makeResult("bash"),
        { command: "ls" },
        pathBearingTools,
      ),
    ).toBeUndefined();
  });

  test("returns undefined for mcp tool", () => {
    const f = makeFormatter();
    expect(
      f.getToolInputPreviewForLog(makeResult("mcp"), {}, pathBearingTools),
    ).toBeUndefined();
  });

  test("returns undefined for mcp source", () => {
    const f = makeFormatter();
    const result = makeResult("some-server:some-tool", { source: "mcp" });
    expect(
      f.getToolInputPreviewForLog(result, {}, pathBearingTools),
    ).toBeUndefined();
  });

  test("returns path-based preview for path-bearing tools", () => {
    const f = makeFormatter();
    const preview = f.getToolInputPreviewForLog(
      makeResult("read"),
      { path: "/src/foo.ts" },
      pathBearingTools,
    );
    expect(preview).toContain("/src/foo.ts");
  });

  test("truncates path preview at toolInputLogPreviewMaxLength", () => {
    const f = makeFormatter({ toolInputLogPreviewMaxLength: 15 });
    const longPath = `/src/${"a".repeat(50)}.ts`;
    const preview = f.getToolInputPreviewForLog(
      makeResult("read"),
      { path: longPath },
      pathBearingTools,
    );
    expect(preview).toBeDefined();
    expect(preview!.length).toBeLessThanOrEqual(16); // 15 + "…"
  });

  test("returns generic JSON preview for non-path-bearing tools", () => {
    mockedStringify.mockReturnValue('{"n":1}');
    const f = makeFormatter();
    const preview = f.getToolInputPreviewForLog(
      makeResult("task"),
      { n: 1 },
      pathBearingTools,
    );
    expect(preview).toContain('{"n":1}');
  });
});

// ── getPermissionLogContext ───────────────────────────────────────────────

describe("ToolPreviewFormatter.getPermissionLogContext", () => {
  const pathBearingTools = new Set(["read", "write", "edit"]);

  test("returns command, target, toolInputPreview, and origin fields", () => {
    const f = makeFormatter();
    const result = makeResult("bash", { command: "ls -la" });
    const ctx = f.getPermissionLogContext(result, {}, pathBearingTools);
    expect(ctx.command).toBe("ls -la");
    expect(ctx.target).toBeUndefined();
    expect(ctx.toolInputPreview).toBeUndefined();
  });

  test("includes toolInputPreview for non-bash path-bearing tools", () => {
    const f = makeFormatter();
    const result = makeResult("read");
    const ctx = f.getPermissionLogContext(
      result,
      { path: "/foo.ts" },
      pathBearingTools,
    );
    expect(ctx.toolInputPreview).toContain("/foo.ts");
  });

  test("includes origin from check result", () => {
    const f = makeFormatter();
    const result = makeResult("read", { origin: "project" });
    const ctx = f.getPermissionLogContext(result, {}, pathBearingTools);
    expect(ctx.origin).toBe("project");
  });

  test("toolInputPreview respects toolInputLogPreviewMaxLength", () => {
    const f = makeFormatter({ toolInputLogPreviewMaxLength: 15 });
    const longPath = `/src/${"a".repeat(50)}.ts`;
    const ctx = f.getPermissionLogContext(
      makeResult("read"),
      { path: longPath },
      pathBearingTools,
    );
    expect(ctx.toolInputPreview).toBeDefined();
    expect(ctx.toolInputPreview!.length).toBeLessThanOrEqual(16);
  });
});
