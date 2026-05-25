import { describe, expect, it } from "vitest";
import type { Theme } from "#src/ui/display";
import type { BashExecutionMessage, FormatterContext } from "#src/ui/message-formatters";
import {
  formatAssistantMessage,
  formatBashExecution,
  formatMessage,
  formatStreamingIndicator,
  formatToolResult,
  formatUserMessage,
} from "#src/ui/message-formatters";

// ── Theme helpers ────────────────────────────────────────────────────────────

/** Label theme: wraps text in [color:text] / [bold:text] for precise assertions. */
const labelTheme: Theme = {
  fg: (color, text) => `[${color}:${text}]`,
  bold: (text) => `[bold:${text}]`,
};

/** Identity theme: returns text unchanged for structure-only assertions. */
const plainTheme: Theme = {
  fg: (_color, text) => text,
  bold: (text) => text,
};

/** No-op wrapText: returns input as a single line. */
const noWrap = (text: string, _width: number): string[] => [text];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("message-formatters", () => {
  describe("formatUserMessage", () => {
    const ctx: FormatterContext = { theme: labelTheme, wrapText: noWrap };

    it("returns null for empty string content", () => {
      expect(formatUserMessage("", 80, ctx)).toBeNull();
    });

    it("returns null for whitespace-only string content", () => {
      expect(formatUserMessage("   \n  ", 80, ctx)).toBeNull();
    });

    it("returns null for empty content array", () => {
      expect(formatUserMessage([], 80, ctx)).toBeNull();
    });

    it("returns null for content array with no text items", () => {
      const content = [{ type: "toolCall", name: "read" }];
      expect(formatUserMessage(content, 80, ctx)).toBeNull();
    });

    it("formats string content with User header and wrapped text", () => {
      const result = formatUserMessage("hello world", 80, ctx);
      expect(result).toEqual(["[accent:[User]]", "hello world"]);
    });

    it("extracts text from content array", () => {
      const content = [{ type: "text", text: "from array" }];
      const result = formatUserMessage(content, 80, ctx);
      expect(result).toEqual(["[accent:[User]]", "from array"]);
    });

    it("trims content before passing to wrapText", () => {
      const result = formatUserMessage("  trimmed  ", 80, ctx);
      expect(result).toEqual(["[accent:[User]]", "trimmed"]);
    });

    it("passes width to wrapText", () => {
      const capturedWidths: number[] = [];
      const capturingWrap = (text: string, width: number): string[] => {
        capturedWidths.push(width);
        return [text];
      };
      formatUserMessage("text", 42, { theme: plainTheme, wrapText: capturingWrap });
      expect(capturedWidths).toEqual([42]);
    });

    it("returns multiple lines when wrapText splits content", () => {
      const splitWrap = (text: string, _width: number): string[] => text.split(" ");
      const result = formatUserMessage("one two three", 80, { theme: plainTheme, wrapText: splitWrap });
      expect(result).toEqual(["[User]", "one", "two", "three"]);
    });
  });

  describe("formatAssistantMessage", () => {
    const ctx: FormatterContext = { theme: labelTheme, wrapText: noWrap };

    it("returns [Assistant] header for empty content", () => {
      expect(formatAssistantMessage([], 80, ctx)).toEqual(["[bold:[Assistant]]"]);
    });

    it("formats text-only content", () => {
      const content = [{ type: "text", text: "Hello from assistant" }];
      const result = formatAssistantMessage(content, 80, ctx);
      expect(result).toEqual(["[bold:[Assistant]]", "Hello from assistant"]);
    });

    it("formats tool-call-only content", () => {
      const content = [{ type: "toolCall", name: "read" }];
      const result = formatAssistantMessage(content, 80, ctx);
      expect(result).toEqual(["[bold:[Assistant]]", "[muted:  [Tool: read]]"]);
    });

    it("formats mixed text and tool calls", () => {
      const content = [
        { type: "text", text: "Let me check" },
        { type: "toolCall", name: "grep" },
      ];
      const result = formatAssistantMessage(content, 80, ctx);
      expect(result).toEqual(["[bold:[Assistant]]", "Let me check", "[muted:  [Tool: grep]]"]);
    });

    it("joins multiple text parts with newline before wrapping", () => {
      const capturedTexts: string[] = [];
      const capturingWrap = (text: string, _width: number): string[] => {
        capturedTexts.push(text);
        return [text];
      };
      const content = [
        { type: "text", text: "Part A" },
        { type: "text", text: "Part B" },
      ];
      formatAssistantMessage(content, 80, { theme: plainTheme, wrapText: capturingWrap });
      expect(capturedTexts).toEqual(["Part A\nPart B"]);
    });

    it("skips text items with no text value", () => {
      const content = [{ type: "text" }, { type: "text", text: "" }];
      const result = formatAssistantMessage(content, 80, ctx);
      expect(result).toEqual(["[bold:[Assistant]]"]);
    });

    it("skips unknown content types", () => {
      const content = [{ type: "image" }];
      const result = formatAssistantMessage(content, 80, ctx);
      expect(result).toEqual(["[bold:[Assistant]]"]);
    });

    it("includes provider/model attribution when both present", () => {
      const content = [{ type: "text", text: "hi" }];
      const result = formatAssistantMessage(content, 80, ctx, {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      });
      expect(result).toEqual([
        "[bold:[Assistant (anthropic/claude-sonnet-4-20250514)]]",
        "hi",
      ]);
    });

    it("includes provider-only attribution", () => {
      const content = [{ type: "text", text: "hi" }];
      const result = formatAssistantMessage(content, 80, ctx, { provider: "openai" });
      expect(result).toEqual(["[bold:[Assistant (openai)]]", "hi"]);
    });

    it("includes model-only attribution", () => {
      const content = [{ type: "text", text: "hi" }];
      const result = formatAssistantMessage(content, 80, ctx, { model: "gpt-4o" });
      expect(result).toEqual(["[bold:[Assistant (gpt-4o)]]", "hi"]);
    });

    it("omits attribution when both undefined", () => {
      const content = [{ type: "text", text: "hi" }];
      const result = formatAssistantMessage(content, 80, ctx, {});
      expect(result).toEqual(["[bold:[Assistant]]", "hi"]);
    });
  });

  describe("formatToolResult", () => {
    const ctx: FormatterContext = { theme: labelTheme, wrapText: noWrap };

    it("returns null for empty content array", () => {
      expect(formatToolResult([], 80, ctx)).toBeNull();
    });

    it("returns null when all content items have no text", () => {
      const content = [{ type: "text", text: "" }];
      expect(formatToolResult(content, 80, ctx)).toBeNull();
    });

    it("returns null for whitespace-only content", () => {
      const content = [{ type: "text", text: "   " }];
      expect(formatToolResult(content, 80, ctx)).toBeNull();
    });

    it("formats normal content with Result header", () => {
      const content = [{ type: "text", text: "output" }];
      const result = formatToolResult(content, 80, ctx);
      expect(result).toEqual(["[dim:[Result]]", "[dim:output]"]);
    });

    it("applies dim styling to each body line", () => {
      const splitWrap = (text: string, _width: number): string[] => text.split("\n");
      const content = [{ type: "text", text: "line1\nline2" }];
      const result = formatToolResult(content, 80, { theme: labelTheme, wrapText: splitWrap });
      expect(result).toEqual(["[dim:[Result]]", "[dim:line1]", "[dim:line2]"]);
    });

    it("truncates content exceeding 500 chars", () => {
      const longText = "A".repeat(600);
      const content = [{ type: "text", text: longText }];
      const result = formatToolResult(content, 80, ctx);
      expect(result).not.toBeNull();
      // Body line should contain the truncated text in dim styling
      const bodyLine = result![1];
      expect(bodyLine).toContain("A".repeat(500));
      expect(bodyLine).toContain("... (truncated)");
    });

    it("does not truncate content at exactly 500 chars", () => {
      const exactText = "B".repeat(500);
      const content = [{ type: "text", text: exactText }];
      const result = formatToolResult(content, 80, ctx);
      expect(result).not.toBeNull();
      expect(result![1]).toBe(`[dim:${ "B".repeat(500)}]`);
    });

    it("trims content before wrapping", () => {
      const capturedTexts: string[] = [];
      const capturingWrap = (text: string, _width: number): string[] => {
        capturedTexts.push(text);
        return [text];
      };
      const content = [{ type: "text", text: "  trimmed  " }];
      formatToolResult(content, 80, { theme: plainTheme, wrapText: capturingWrap });
      expect(capturedTexts).toEqual(["trimmed"]);
    });
  });

  describe("formatBashExecution", () => {
    const ctx: FormatterContext = { theme: labelTheme, wrapText: noWrap };

    function makeMsg(overrides: Partial<BashExecutionMessage> = {}): BashExecutionMessage {
      return { role: "bashExecution", command: "ls", output: "", ...overrides };
    }

    it("renders command as first line with $ prefix", () => {
      const result = formatBashExecution(makeMsg({ command: "echo hi" }), 80, ctx);
      expect(result[0]).toBe("[muted:  $ echo hi]");
    });

    it("returns only the command line for empty output", () => {
      const result = formatBashExecution(makeMsg({ output: "" }), 80, ctx);
      expect(result).toHaveLength(1);
    });

    it("returns only the command line for whitespace-only output", () => {
      const result = formatBashExecution(makeMsg({ output: "   " }), 80, ctx);
      expect(result).toHaveLength(1);
    });

    it("wraps non-empty output in dim styling", () => {
      const result = formatBashExecution(makeMsg({ output: "hello" }), 80, ctx);
      expect(result).toHaveLength(2);
      expect(result[1]).toBe("[dim:hello]");
    });

    it("handles missing output field (undefined)", () => {
      const msg = { role: "bashExecution" as const, command: "ls" };
      const result = formatBashExecution(msg, 80, ctx);
      expect(result).toHaveLength(1);
    });

    it("truncates output exceeding 500 chars", () => {
      const longOutput = "X".repeat(600);
      const result = formatBashExecution(makeMsg({ output: longOutput }), 80, ctx);
      expect(result).toHaveLength(2);
      expect(result[1]).toContain("X".repeat(500));
      expect(result[1]).toContain("... (truncated)");
    });

    it("does not truncate output at exactly 500 chars", () => {
      const exactOutput = "Y".repeat(500);
      const result = formatBashExecution(makeMsg({ output: exactOutput }), 80, ctx);
      expect(result).toHaveLength(2);
      expect(result[1]).toBe(`[dim:${exactOutput}]`);
    });

    it("trims output before passing to wrapText", () => {
      const capturedTexts: string[] = [];
      const capturingWrap = (text: string, _width: number): string[] => {
        capturedTexts.push(text);
        return [text];
      };
      formatBashExecution(makeMsg({ output: "  trimmed  " }), 80, { theme: plainTheme, wrapText: capturingWrap });
      expect(capturedTexts).toEqual(["trimmed"]);
    });

    it("applies dim styling to each output line", () => {
      const splitWrap = (text: string, _width: number): string[] => text.split("\n");
      const result = formatBashExecution(
        makeMsg({ output: "line1\nline2" }),
        80,
        { theme: labelTheme, wrapText: splitWrap },
      );
      expect(result).toEqual(["[muted:  $ ls]", "[dim:line1]", "[dim:line2]"]);
    });
  });

  describe("formatStreamingIndicator", () => {
    it("returns exactly two lines", () => {
      const result = formatStreamingIndicator(new Map(), undefined, 80, plainTheme);
      expect(result).toHaveLength(2);
    });

    it("first line is an empty string", () => {
      const result = formatStreamingIndicator(new Map(), undefined, 80, plainTheme);
      expect(result[0]).toBe("");
    });

    it("falls back to 'thinking\u2026' when no tools active and no response text", () => {
      const result = formatStreamingIndicator(new Map(), undefined, 80, plainTheme);
      expect(result[1]).toContain("thinking\u2026");
    });

    it("shows response text when no tools are active", () => {
      const result = formatStreamingIndicator(new Map(), "Working on it", 80, plainTheme);
      expect(result[1]).toContain("Working on it");
    });

    it("shows tool activity description when tools are active", () => {
      const activeTools = new Map([["t1", "read"]]);
      const result = formatStreamingIndicator(activeTools, undefined, 80, plainTheme);
      expect(result[1]).toContain("reading");
    });

    it("includes accent-colored cursor marker", () => {
      const result = formatStreamingIndicator(new Map(), undefined, 80, labelTheme);
      expect(result[1]).toContain("[accent:\u25cd ");
    });
  });

  describe("formatMessage", () => {
    const ctx: FormatterContext = { theme: plainTheme, wrapText: noWrap };

    it("returns null for an unknown role", () => {
      expect(formatMessage({ role: "system" }, 80, ctx)).toBeNull();
    });

    it("returns null for empty user message", () => {
      expect(formatMessage({ role: "user", content: "" }, 80, ctx)).toBeNull();
    });

    it("delegates user role to formatUserMessage", () => {
      const result = formatMessage({ role: "user", content: "hi" }, 80, ctx);
      expect(result).toEqual(formatUserMessage("hi", 80, ctx));
    });

    it("delegates assistant role to formatAssistantMessage", () => {
      const content = [{ type: "text", text: "response" }];
      const result = formatMessage({ role: "assistant", content }, 80, ctx);
      expect(result).toEqual(formatAssistantMessage(content, 80, ctx));
    });

    it("passes provider/model attribution through to formatAssistantMessage", () => {
      const content = [{ type: "text", text: "response" }];
      const result = formatMessage(
        { role: "assistant", content, provider: "anthropic", model: "claude-sonnet-4-20250514" },
        80,
        ctx,
      );
      expect(result).toEqual(
        formatAssistantMessage(content, 80, ctx, {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        }),
      );
    });

    it("delegates toolResult role to formatToolResult", () => {
      const content = [{ type: "text", text: "result" }];
      const result = formatMessage({ role: "toolResult", content }, 80, ctx);
      expect(result).toEqual(formatToolResult(content, 80, ctx));
    });

    it("returns null for empty toolResult content", () => {
      expect(formatMessage({ role: "toolResult", content: [] }, 80, ctx)).toBeNull();
    });

    it("delegates bashExecution role to formatBashExecution", () => {
      const msg = { role: "bashExecution" as const, command: "ls", output: "file.ts" };
      const result = formatMessage(msg, 80, ctx);
      expect(result).toEqual(formatBashExecution(msg, 80, ctx));
    });
  });
});
