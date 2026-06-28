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
// Default implementation is identity — lexical assertions are unaffected.
const realpathSync = vi.hoisted(() =>
  vi.fn<(path: string) => string>((p) => p),
);
vi.mock("node:fs", () => ({
  realpathSync,
  default: { realpathSync },
}));

import { PathNormalizer } from "#src/path-normalizer";

describe("PathNormalizer", () => {
  beforeEach(() => {
    realpathSync.mockReset();
    realpathSync.mockImplementation((p: string) => p);
  });

  describe("posix flavor", () => {
    const normalizer = new PathNormalizer("linux", "/projects/my-app");

    test("forPath builds an AccessPath resolved against the baked cwd", () => {
      const ap = normalizer.forPath("src/foo.ts");
      expect(ap.value()).toBe("/projects/my-app/src/foo.ts");
      expect(ap.matchValues()).toEqual([
        "/projects/my-app/src/foo.ts",
        "src/foo.ts",
      ]);
    });

    test("forPath honors an explicit resolveBase", () => {
      const ap = normalizer.forPath("foo.ts", {
        resolveBase: "/projects/my-app/sub",
      });
      expect(ap.value()).toBe("/projects/my-app/sub/foo.ts");
    });

    test("forLiteral builds a literal-only AccessPath", () => {
      const ap = normalizer.forLiteral("foo.ts");
      expect(ap.matchValues()).toEqual(["foo.ts"]);
      expect(ap.boundaryValue()).toBe("");
    });

    test("isAbsolute uses posix rules", () => {
      expect(normalizer.isAbsolute("/etc/hosts")).toBe(true);
      expect(normalizer.isAbsolute("rel/path")).toBe(false);
    });

    test("resolveBase resolves an offset against the baked cwd", () => {
      expect(normalizer.resolveBase("sub")).toBe("/projects/my-app/sub");
      expect(normalizer.resolveBase("/abs")).toBe("/abs");
    });

    test("joinBase joins an offset with a relative target", () => {
      expect(normalizer.joinBase("sub", "nested")).toBe("sub/nested");
    });

    test("isWithinDirectory decides containment", () => {
      expect(normalizer.isWithinDirectory("/a/b/c", "/a/b")).toBe(true);
      expect(normalizer.isWithinDirectory("/a/x", "/a/b")).toBe(false);
    });

    test("isOutsideWorkingDirectory tests against the baked cwd", () => {
      expect(normalizer.isOutsideWorkingDirectory("/projects/my-app/src")).toBe(
        false,
      );
      expect(normalizer.isOutsideWorkingDirectory("/etc/hosts")).toBe(true);
    });
  });

  describe("win32 flavor", () => {
    const normalizer = new PathNormalizer("win32", "C:\\Projects\\App");

    test("forPath builds a case-folded AccessPath with win32 rules", () => {
      const ap = normalizer.forPath("src\\foo.ts");
      expect(ap.value()).toBe("c:\\projects\\app\\src\\foo.ts");
      expect(ap.matchValues()).toEqual([
        "c:\\projects\\app\\src\\foo.ts",
        "src\\foo.ts",
      ]);
    });

    test("isAbsolute uses win32 rules", () => {
      expect(normalizer.isAbsolute("C:\\Users\\foo")).toBe(true);
      expect(normalizer.isAbsolute("rel\\path")).toBe(false);
    });

    test("resolveBase resolves an offset against the baked cwd", () => {
      expect(normalizer.resolveBase("sub")).toBe("C:\\Projects\\App\\sub");
    });

    test("joinBase joins an offset with a relative target", () => {
      expect(normalizer.joinBase("sub", "nested")).toBe("sub\\nested");
    });

    test("isWithinDirectory folds case", () => {
      expect(
        normalizer.isWithinDirectory(
          "c:\\users\\foo\\dir\\sub",
          "C:\\Users\\Foo\\dir",
        ),
      ).toBe(true);
    });

    test("isOutsideWorkingDirectory case-folds against the baked cwd", () => {
      expect(
        normalizer.isOutsideWorkingDirectory("c:\\projects\\app\\src"),
      ).toBe(false);
      expect(normalizer.isOutsideWorkingDirectory("C:\\Other\\dir")).toBe(true);
    });
  });
});
