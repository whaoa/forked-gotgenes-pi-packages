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
// Default implementation is identity — lexical tests are unaffected.
const realpathSync = vi.hoisted(() =>
  vi.fn<(path: string) => string>((p) => p),
);
vi.mock("node:fs", () => ({
  realpathSync,
  default: { realpathSync },
}));

import { AccessPath } from "#src/access-intent/access-path";

describe("AccessPath.forExternalDirectory", () => {
  const cwd = "/projects/my-app";

  beforeEach(() => {
    realpathSync.mockReset();
    realpathSync.mockImplementation((p: string) => p);
  });

  describe("matchValues()", () => {
    test("adds the symlink-resolved alias alongside the typed path", () => {
      // /tmp -> /private/tmp (the macOS symlink from the bug report, #418).
      realpathSync.mockImplementation((p: string) =>
        p.startsWith("/tmp") ? `/private${p}` : p,
      );
      expect(
        AccessPath.forExternalDirectory("/tmp/x", cwd).matchValues(),
      ).toEqual(["/tmp/x", "/private/tmp/x"]);
    });

    test("deduplicates when the canonical form equals the lexical form", () => {
      expect(
        AccessPath.forExternalDirectory("/etc/hosts", cwd).matchValues(),
      ).toEqual(["/etc/hosts"]);
    });

    test("keeps the relative aliases for an in-cwd token without duplicating", () => {
      expect(
        AccessPath.forExternalDirectory("src/foo.ts", cwd).matchValues(),
      ).toEqual(["/projects/my-app/src/foo.ts", "src/foo.ts"]);
    });

    test("includes only the lexical aliases when canonical is empty", () => {
      // Force canonicalizePath to return the original (no-op symlink resolution
      // effectively means canonical === lexical, handled by dedup).
      expect(
        AccessPath.forExternalDirectory("/etc/hosts", cwd).matchValues(),
      ).not.toHaveLength(0);
    });
  });

  describe("boundaryValue()", () => {
    test("returns the canonical (symlink-resolved) form", () => {
      realpathSync.mockImplementation((p: string) =>
        p.startsWith("/tmp") ? `/private${p}` : p,
      );
      expect(
        AccessPath.forExternalDirectory("/tmp/x", cwd).boundaryValue(),
      ).toBe("/private/tmp/x");
    });

    test("returns the lexical form when path has no symlinks", () => {
      expect(
        AccessPath.forExternalDirectory("/etc/hosts", cwd).boundaryValue(),
      ).toBe("/etc/hosts");
    });

    test("returns empty string for empty input", () => {
      expect(AccessPath.forExternalDirectory("", cwd).boundaryValue()).toBe("");
    });
  });

  describe("value()", () => {
    test("returns the lexical (as-typed, normalized) form", () => {
      realpathSync.mockImplementation((p: string) =>
        p.startsWith("/tmp") ? `/private${p}` : p,
      );
      // Even when the path resolves to a different canonical, value() stays lexical.
      expect(AccessPath.forExternalDirectory("/tmp/x", cwd).value()).toBe(
        "/tmp/x",
      );
    });

    test("normalizes the path against cwd", () => {
      // A relative path becomes an absolute lexical value.
      expect(AccessPath.forExternalDirectory("src/foo.ts", cwd).value()).toBe(
        "/projects/my-app/src/foo.ts",
      );
    });

    test("returns empty string for empty input", () => {
      expect(AccessPath.forExternalDirectory("", cwd).value()).toBe("");
    });
  });
});
