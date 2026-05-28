import { describe, expect, it } from "vitest";
import { formatTranscript } from "#src/format-transcript";

function makeUserEntry(content: unknown, id = "1"): Record<string, unknown> {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    message: {
      role: "user",
      content,
      timestamp: 1000,
    },
  };
}

function makeAssistantEntry(
  textParts: string | string[],
  provider = "anthropic",
  model = "claude-sonnet-4-20250514",
  id = "2",
): Record<string, unknown> {
  const contentArr = (Array.isArray(textParts) ? textParts : [textParts]).map(
    (t) => ({ type: "text", text: t }),
  );
  return {
    type: "message",
    id,
    parentId: "1",
    timestamp: "2026-01-01T00:00:01Z",
    message: {
      role: "assistant",
      content: contentArr,
      provider,
      model,
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 2000,
    },
  };
}

describe("formatTranscript — tool calls and result folding", () => {
  it("formats an assistant message with a single tool call and correlated result", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me read that file." },
            {
              type: "toolCall",
              id: "tc-1",
              name: "Read",
              arguments: { path: "src/auth.ts" },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "Read",
          content: [{ type: "text", text: "file contents here" }],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toBe(
      "1. assistant [anthropic/claude-sonnet-4-20250514]\nLet me read that file.\n  [tool] Read — path: src/auth.ts → completed",
    );
  });

  it("marks a tool call as error when the result is an error", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-2",
              name: "Bash",
              arguments: { command: "pnpm vitest run" },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-2",
          toolName: "Bash",
          content: [{ type: "text", text: "FAIL" }],
          isError: true,
        },
      },
    ];
    expect(formatTranscript(entries)).toBe(
      "1. assistant [anthropic/claude-sonnet-4-20250514]\n  [tool] Bash — command: pnpm vitest run → error",
    );
  });

  it("handles parallel tool calls with out-of-order results", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-a",
              name: "Read",
              arguments: { path: "a.ts" },
            },
            {
              type: "toolCall",
              id: "tc-b",
              name: "Read",
              arguments: { path: "b.ts" },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      // results arrive in reverse order
      {
        type: "message",
        id: "3",
        parentId: "2",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-b",
          toolName: "Read",
          content: [],
          isError: false,
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-a",
          toolName: "Read",
          content: [],
          isError: false,
        },
      },
    ];
    const result = formatTranscript(entries);
    expect(result).toBe(
      "1. assistant [anthropic/claude-sonnet-4-20250514]\n" +
        "  [tool] Read — path: a.ts → completed\n" +
        "  [tool] Read — path: b.ts → completed",
    );
  });

  it("renders orphan tool result (no matching call) as standalone line", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "missing-id",
          toolName: "Read",
          content: [],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toBe("  [result] Read → completed");
  });

  it("extracts path hint for Read tool", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-1",
              name: "Read",
              arguments: { path: "src/index.ts" },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "Read",
          content: [],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toContain("Read — path: src/index.ts");
  });

  it("extracts command hint for Bash tool, truncated to 80 chars", () => {
    const longCmd = `pnpm vitest run ${"x".repeat(100)}`;
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-1",
              name: "Bash",
              arguments: { command: longCmd },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "Bash",
          content: [],
          isError: false,
        },
      },
    ];
    const result = formatTranscript(entries);
    expect(result).toContain("Bash — command: pnpm vitest run ");
    // hint is capped at 80 chars
    const hint = /Bash — command: (.+?) →/.exec(result)?.[1] ?? "";
    expect(hint.length).toBeLessThanOrEqual(80);
  });

  it("extracts path hint for Edit tool", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-1",
              name: "Edit",
              arguments: { path: "src/foo.ts", edits: [] },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "Edit",
          content: [],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toContain("Edit — path: src/foo.ts");
  });

  it("extracts pattern hint for Grep tool", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-1",
              name: "Grep",
              arguments: { pattern: "formatTranscript", path: "src" },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "Grep",
          content: [],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toContain(
      "Grep — pattern: formatTranscript",
    );
  });

  it("falls back to first key-value for unknown tool", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-1",
              name: "custom_tool",
              arguments: { query: "find me something" },
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "custom_tool",
          content: [],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toContain(
      "custom_tool — query: find me something",
    );
  });

  it("shows no arg hint when tool arguments are empty", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "t",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "tc-1",
              name: "get_session_name",
              arguments: {},
            },
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "t",
        message: {
          role: "toolResult",
          toolCallId: "tc-1",
          toolName: "get_session_name",
          content: [],
          isError: false,
        },
      },
    ];
    expect(formatTranscript(entries)).toContain(
      "  [tool] get_session_name → completed",
    );
  });
});

describe("formatTranscript — basic message formatting", () => {
  it("returns empty string for empty entries", () => {
    expect(formatTranscript([])).toBe("");
  });

  it("formats a user message with string content", () => {
    const entries = [makeUserEntry("How do I fix the login bug?")];
    expect(formatTranscript(entries)).toBe(
      "1. user\nHow do I fix the login bug?",
    );
  });

  it("formats a user message with TextContent array, joining text parts", () => {
    const entries = [
      makeUserEntry([
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ]),
    ];
    expect(formatTranscript(entries)).toBe("1. user\nHello world");
  });

  it("skips non-text content (images) in user message array", () => {
    const entries = [
      makeUserEntry([
        { type: "text", text: "What is in this image?" },
        { type: "image", data: "base64data", mimeType: "image/png" },
      ]),
    ];
    expect(formatTranscript(entries)).toBe("1. user\nWhat is in this image?");
  });

  it("formats an assistant message with model attribution", () => {
    const entries = [
      makeAssistantEntry(
        "Let me help you.",
        "anthropic",
        "claude-opus-4-20250514",
      ),
    ];
    expect(formatTranscript(entries)).toBe(
      "1. assistant [anthropic/claude-opus-4-20250514]\nLet me help you.",
    );
  });

  it("uses [unknown/unknown] when provider/model fields are absent", () => {
    const entry = {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "t",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hi" }],
      },
    };
    expect(formatTranscript([entry])).toBe(
      "1. assistant [unknown/unknown]\nHi",
    );
  });

  it("assigns sequential turn numbers across user and assistant messages", () => {
    const entries = [
      makeUserEntry("First", "1"),
      makeAssistantEntry(
        "Second",
        "anthropic",
        "claude-sonnet-4-20250514",
        "2",
      ),
      makeUserEntry("Third", "3"),
    ];
    const result = formatTranscript(entries);
    expect(result).toContain("1. user\nFirst");
    expect(result).toContain(
      "2. assistant [anthropic/claude-sonnet-4-20250514]\nSecond",
    );
    expect(result).toContain("3. user\nThird");
  });

  it("joins entries with --- separator", () => {
    const entries = [
      makeUserEntry("Hello", "1"),
      makeAssistantEntry(
        "Hi there",
        "anthropic",
        "claude-sonnet-4-20250514",
        "2",
      ),
    ];
    expect(formatTranscript(entries)).toBe(
      "1. user\nHello\n\n---\n\n2. assistant [anthropic/claude-sonnet-4-20250514]\nHi there",
    );
  });

  it("omits thinking content from assistant message", () => {
    const entry = {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "t",
      message: {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "Let me reason...",
            thinkingSignature: "sig",
          },
          { type: "text", text: "The answer is 42." },
        ],
        provider: "anthropic",
        model: "claude-opus-4-20250514",
      },
    };
    expect(formatTranscript([entry])).toBe(
      "1. assistant [anthropic/claude-opus-4-20250514]\nThe answer is 42.",
    );
  });

  it("concatenates multiple text blocks in assistant message", () => {
    const entries = [makeAssistantEntry(["First block.", "Second block."])];
    expect(formatTranscript(entries)).toBe(
      "1. assistant [anthropic/claude-sonnet-4-20250514]\nFirst block.\nSecond block.",
    );
  });
});
