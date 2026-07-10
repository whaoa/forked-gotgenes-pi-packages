import { describe, expect, test } from "vitest";
import { classifyToolKind } from "#src/access-intent/tool-kind";
import { PATH_BEARING_TOOLS } from "#src/path-surfaces";

describe("classifyToolKind", () => {
  test("classifies bash", () => {
    expect(classifyToolKind("bash")).toBe("bash");
  });

  test("classifies mcp", () => {
    expect(classifyToolKind("mcp")).toBe("mcp");
  });

  test("classifies skill", () => {
    expect(classifyToolKind("skill")).toBe("skill");
  });

  test("classifies every path-bearing built-in tool as path", () => {
    for (const tool of PATH_BEARING_TOOLS) {
      expect(classifyToolKind(tool)).toBe("path");
    }
  });

  test("classifies an arbitrary extension tool as extension", () => {
    expect(classifyToolKind("task")).toBe("extension");
    expect(classifyToolKind("third_party_tool")).toBe("extension");
  });

  test("classifies the special path surfaces as extension", () => {
    // `path` and `external_directory` are not tool names — they reach the
    // classifier only as normalized surface names in `deriveSource`, where the
    // `SPECIAL_PERMISSION_KEYS` check maps them to `special` before the kind.
    expect(classifyToolKind("path")).toBe("extension");
    expect(classifyToolKind("external_directory")).toBe("extension");
  });

  test("trims surrounding whitespace before classifying", () => {
    expect(classifyToolKind(" bash ")).toBe("bash");
    expect(classifyToolKind("\tmcp\n")).toBe("mcp");
    expect(classifyToolKind("  read  ")).toBe("path");
  });
});
