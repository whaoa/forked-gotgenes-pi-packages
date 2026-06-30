import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock node:os so tilde-expansion is deterministic across platforms.
vi.mock("node:os", () => {
  const homedir = vi.fn(() => "/mock/home");
  return {
    homedir,
    default: { homedir },
  };
});

// Mock node:fs so realpathSync (used by canonicalizePath) is controllable.
// Default implementation is identity — existing lexical tests are unaffected.
const realpathSync = vi.hoisted(() =>
  vi.fn<(path: string) => string>((p) => p),
);
vi.mock("node:fs", () => ({
  realpathSync,
  default: { realpathSync },
}));

import {
  canonicalNormalizePathForComparison,
  getPathPolicyValues,
  isPathOutsideWorkingDirectory,
  isPathWithinDirectory,
  normalizePathForComparison,
  normalizePathPolicyLiteral,
} from "#src/path-utils";

describe("normalizePathForComparison", () => {
  const cwd = "/projects/my-app";

  test("resolves absolute path unchanged", () => {
    expect(normalizePathForComparison("/usr/local/bin", cwd, "linux")).toBe(
      "/usr/local/bin",
    );
  });

  test("resolves relative path against cwd", () => {
    expect(normalizePathForComparison("src/foo.ts", cwd, "linux")).toBe(
      "/projects/my-app/src/foo.ts",
    );
  });

  test("expands bare ~ to homedir", () => {
    expect(normalizePathForComparison("~", cwd, "linux")).toBe("/mock/home");
  });

  test("expands ~/... to homedir-relative path", () => {
    expect(normalizePathForComparison("~/docs/readme.md", cwd, "linux")).toBe(
      join("/mock/home", "docs/readme.md"),
    );
  });

  test("expands bare $HOME to homedir", () => {
    expect(normalizePathForComparison("$HOME", cwd, "linux")).toBe(
      "/mock/home",
    );
  });

  test("expands $HOME/... to homedir-relative path", () => {
    expect(normalizePathForComparison("$HOME/.ssh/config", cwd, "linux")).toBe(
      join("/mock/home", ".ssh/config"),
    );
  });

  test("strips leading @ before resolving", () => {
    expect(normalizePathForComparison("@/usr/local/bin", cwd, "linux")).toBe(
      "/usr/local/bin",
    );
  });

  test("strips surrounding quotes", () => {
    expect(normalizePathForComparison("'/usr/local/bin'", cwd, "linux")).toBe(
      "/usr/local/bin",
    );
    expect(normalizePathForComparison('"/usr/local/bin"', cwd, "linux")).toBe(
      "/usr/local/bin",
    );
  });

  test("returns empty string for blank/whitespace-only path", () => {
    expect(normalizePathForComparison("", cwd, "linux")).toBe("");
    expect(normalizePathForComparison("   ", cwd, "linux")).toBe("");
  });

  // ── injected platform flavor (Windows is case-folded, win32-resolved) ────

  test("win32: lowercases the resolved absolute path", () => {
    expect(
      normalizePathForComparison(
        "C:\\Users\\Foo\\Bar.txt",
        "C:\\Projects",
        "win32",
      ),
    ).toBe("c:\\users\\foo\\bar.txt");
  });

  test("win32: resolves a relative path against cwd with win32 rules", () => {
    expect(
      normalizePathForComparison("src\\foo.ts", "C:\\Projects\\App", "win32"),
    ).toBe("c:\\projects\\app\\src\\foo.ts");
  });

  test("posix platform leaves case untouched", () => {
    expect(
      normalizePathForComparison("/Projects/App/Src.ts", cwd, "linux"),
    ).toBe("/Projects/App/Src.ts");
  });
});

describe("isPathWithinDirectory", () => {
  test("returns true when path equals directory", () => {
    expect(isPathWithinDirectory("/a/b", "/a/b", "linux")).toBe(true);
  });

  test("returns true when path is a direct child", () => {
    expect(isPathWithinDirectory("/a/b/c", "/a/b", "linux")).toBe(true);
  });

  test("returns true when path is a deep descendant", () => {
    expect(isPathWithinDirectory("/a/b/c/d/e", "/a/b", "linux")).toBe(true);
  });

  test("returns false when path is a sibling directory", () => {
    expect(isPathWithinDirectory("/a/bc", "/a/b", "linux")).toBe(false);
  });

  test("returns false when path is outside the directory", () => {
    expect(isPathWithinDirectory("/other/path", "/a/b", "linux")).toBe(false);
  });

  test("returns false for empty path", () => {
    expect(isPathWithinDirectory("", "/a/b", "linux")).toBe(false);
  });

  test("returns false for empty directory", () => {
    expect(isPathWithinDirectory("/a/b", "", "linux")).toBe(false);
  });

  // ── platform-aware containment (Windows is case-insensitive) ────────────

  test("win32: folds case for a case-different descendant", () => {
    expect(
      isPathWithinDirectory(
        "c:\\users\\foo\\dir\\sub\\x.md",
        "C:\\Users\\Foo\\dir",
        "win32",
      ),
    ).toBe(true);
  });

  test("win32: folds case when path equals directory in different case", () => {
    expect(
      isPathWithinDirectory(
        "c:\\users\\foo\\dir\\sub",
        "C:\\USERS\\foo\\DIR",
        "win32",
      ),
    ).toBe(true);
  });

  test("win32: rejects a sibling directory", () => {
    expect(
      isPathWithinDirectory(
        "C:\\Users\\Foo\\other",
        "C:\\Users\\Foo\\dir",
        "win32",
      ),
    ).toBe(false);
  });

  test("posix platform stays case-sensitive", () => {
    expect(isPathWithinDirectory("/a/B/c", "/a/b", "linux")).toBe(false);
  });
});

describe("isPathOutsideWorkingDirectory", () => {
  // Pure geometry over already-canonical operands: the caller (PathNormalizer)
  // prepares the canonical path and cwd; this predicate never canonicalizes.
  const canonicalCwd = "/projects/my-app";

  test("does not canonicalize its operands (no filesystem access)", () => {
    realpathSync.mockClear();
    isPathOutsideWorkingDirectory(
      "/projects/my-app/src",
      canonicalCwd,
      "linux",
    );
    expect(realpathSync).not.toHaveBeenCalled();
  });

  test("returns false when path is inside cwd", () => {
    expect(
      isPathOutsideWorkingDirectory(
        "/projects/my-app/src",
        canonicalCwd,
        "linux",
      ),
    ).toBe(false);
  });

  test("returns false when path equals cwd", () => {
    expect(
      isPathOutsideWorkingDirectory("/projects/my-app", canonicalCwd, "linux"),
    ).toBe(false);
  });

  test("returns true when path is outside cwd", () => {
    expect(
      isPathOutsideWorkingDirectory("/etc/passwd", canonicalCwd, "linux"),
    ).toBe(true);
  });

  test("returns false for an empty canonical path", () => {
    expect(isPathOutsideWorkingDirectory("", canonicalCwd, "linux")).toBe(
      false,
    );
  });

  test("returns false for an empty canonical cwd", () => {
    expect(isPathOutsideWorkingDirectory("/etc/passwd", "", "linux")).toBe(
      false,
    );
  });

  test("returns false for /dev/null (safe system path)", () => {
    expect(
      isPathOutsideWorkingDirectory("/dev/null", canonicalCwd, "linux"),
    ).toBe(false);
  });

  test("returns false for /dev/stdin (safe system path)", () => {
    expect(
      isPathOutsideWorkingDirectory("/dev/stdin", canonicalCwd, "linux"),
    ).toBe(false);
  });

  test("returns false for /dev/stdout (safe system path)", () => {
    expect(
      isPathOutsideWorkingDirectory("/dev/stdout", canonicalCwd, "linux"),
    ).toBe(false);
  });

  test("returns false for /dev/stderr (safe system path)", () => {
    expect(
      isPathOutsideWorkingDirectory("/dev/stderr", canonicalCwd, "linux"),
    ).toBe(false);
  });

  test("returns true for /dev/null/subdir (not a safe path)", () => {
    expect(
      isPathOutsideWorkingDirectory("/dev/null/subdir", canonicalCwd, "linux"),
    ).toBe(true);
  });
});

describe("canonicalNormalizePathForComparison", () => {
  const cwd = "/projects/my-app";

  beforeEach(() => {
    realpathSync.mockReset();
    realpathSync.mockImplementation((p: string) => p);
  });

  test("returns canonical form of an existing path", () => {
    realpathSync.mockImplementation((p: string) => {
      if (p === "/projects/link") return "/real/projects/app";
      return p;
    });
    expect(
      canonicalNormalizePathForComparison("/projects/link", cwd, "linux"),
    ).toBe("/real/projects/app");
  });

  test("returns empty string for empty input", () => {
    expect(canonicalNormalizePathForComparison("", cwd, "linux")).toBe("");
  });

  test("returns lexical form when no symlinks (identity realpathSync)", () => {
    expect(
      canonicalNormalizePathForComparison(
        "/projects/my-app/src/index.ts",
        cwd,
        "linux",
      ),
    ).toBe("/projects/my-app/src/index.ts");
  });

  test("win32: lowercases the canonical form", () => {
    expect(
      canonicalNormalizePathForComparison(
        "C:\\Projects\\App\\Src",
        "C:\\Projects\\App",
        "win32",
      ),
    ).toBe("c:\\projects\\app\\src");
  });
});

describe("normalizePathPolicyLiteral", () => {
  test("returns a relative token unchanged", () => {
    expect(normalizePathPolicyLiteral("src/foo.ts")).toBe("src/foo.ts");
  });

  test("trims and strips simple wrapping quotes", () => {
    expect(normalizePathPolicyLiteral("  'src/foo.ts'  ")).toBe("src/foo.ts");
    expect(normalizePathPolicyLiteral('"a/b"')).toBe("a/b");
  });

  test("strips a leading @ prefix", () => {
    expect(normalizePathPolicyLiteral("@src/foo.ts")).toBe("src/foo.ts");
  });

  test("expands ~ to the home directory", () => {
    expect(normalizePathPolicyLiteral("~/docs/readme.md")).toBe(
      join("/mock/home", "docs/readme.md"),
    );
  });

  test("does not resolve a relative value against any cwd", () => {
    expect(normalizePathPolicyLiteral("foo.ts")).toBe("foo.ts");
  });

  test("returns empty string for blank input", () => {
    expect(normalizePathPolicyLiteral("   ")).toBe("");
  });

  test("preserves the surface catch-all", () => {
    expect(normalizePathPolicyLiteral("*")).toBe("*");
  });
});

describe("getPathPolicyValues", () => {
  const cwd = "/projects/my-app";

  test("returns only the literal when no base is available", () => {
    expect(getPathPolicyValues("src/foo.ts", {}, "linux")).toEqual([
      "src/foo.ts",
    ]);
    expect(getPathPolicyValues("src/foo.ts", {}, "linux")).toEqual([
      "src/foo.ts",
    ]);
  });

  test("adds absolute and project-relative aliases for a relative token", () => {
    expect(getPathPolicyValues("src/foo.ts", { cwd }, "linux")).toEqual([
      "/projects/my-app/src/foo.ts",
      "src/foo.ts",
    ]);
  });

  test("omits the relative alias for a token outside cwd", () => {
    expect(getPathPolicyValues("/etc/hosts", { cwd }, "linux")).toEqual([
      "/etc/hosts",
    ]);
  });

  test("resolves against resolveBase while aliasing relative to cwd", () => {
    expect(
      getPathPolicyValues(
        "foo.txt",
        {
          cwd,
          resolveBase: "/projects/my-app/nested",
        },
        "linux",
      ),
    ).toEqual(["/projects/my-app/nested/foo.txt", "nested/foo.txt", "foo.txt"]);
  });

  test("preserves the surface catch-all", () => {
    expect(getPathPolicyValues("*", { cwd }, "linux")).toEqual(["*"]);
  });

  test("returns empty for blank input", () => {
    expect(getPathPolicyValues("   ", { cwd }, "linux")).toEqual([]);
  });
});
