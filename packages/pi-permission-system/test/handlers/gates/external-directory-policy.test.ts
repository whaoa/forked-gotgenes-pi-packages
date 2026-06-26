import { describe, expect, it } from "vitest";
import { AccessPath } from "#src/access-intent/access-path";
import {
  resolveExternalDirectoryPolicy,
  selectUncoveredExternalPaths,
} from "#src/handlers/gates/external-directory-policy";
import type { PermissionCheckResult } from "#src/types";

import { makeResolver } from "#test/helpers/gate-fixtures";

const cwd = "/test/project";

function makeCheckResult(
  state: "allow" | "deny" | "ask",
  overrides: Partial<PermissionCheckResult> = {},
): PermissionCheckResult {
  return {
    state,
    toolName: "external_directory",
    source: "special",
    origin: "builtin",
    ...overrides,
  };
}

describe("resolveExternalDirectoryPolicy", () => {
  it("resolves the path's match aliases on the external_directory surface (#418)", () => {
    const path = AccessPath.forExternalDirectory("/outside/a.ts", cwd);
    const resolver = makeResolver(makeCheckResult("ask"));

    const result = resolveExternalDirectoryPolicy(path, resolver, undefined);

    expect(resolver.resolvePathPolicy).toHaveBeenCalledWith(
      path.matchValues(),
      undefined,
      "external_directory",
    );
    expect(result).toEqual(makeCheckResult("ask"));
  });

  it("threads the agent name through to the resolver", () => {
    const path = AccessPath.forExternalDirectory("/outside/a.ts", cwd);
    const resolver = makeResolver(makeCheckResult("allow"));

    resolveExternalDirectoryPolicy(path, resolver, "reviewer");

    expect(resolver.resolvePathPolicy).toHaveBeenCalledWith(
      path.matchValues(),
      "reviewer",
      "external_directory",
    );
  });
});

describe("selectUncoveredExternalPaths", () => {
  it("returns no uncovered paths when every path resolves to allow", () => {
    const paths = [
      AccessPath.forExternalDirectory("/outside/a.ts", cwd),
      AccessPath.forExternalDirectory("/outside/b.ts", cwd),
    ];
    const resolver = makeResolver(makeCheckResult("allow"));

    const { uncovered, worstCheck } = selectUncoveredExternalPaths(
      paths,
      resolver,
      undefined,
    );

    expect(uncovered).toEqual([]);
    expect(worstCheck).toBeUndefined();
  });

  it("collects only paths whose resolved state is not allow", () => {
    const allowed = AccessPath.forExternalDirectory("/outside/ok.ts", cwd);
    const asked = AccessPath.forExternalDirectory("/outside/ask.ts", cwd);
    const resolver = makeResolver();
    resolver.resolvePathPolicy.mockImplementation(
      (values: readonly string[]) =>
        values.includes("/outside/ok.ts")
          ? makeCheckResult("allow")
          : makeCheckResult("ask"),
    );

    const { uncovered } = selectUncoveredExternalPaths(
      [allowed, asked],
      resolver,
      undefined,
    );

    expect(uncovered.map(({ path }) => path.value())).toEqual([asked.value()]);
  });

  it("returns the most restrictive uncovered check as worstCheck (deny > ask)", () => {
    const asked = AccessPath.forExternalDirectory("/outside/ask.ts", cwd);
    const denied = AccessPath.forExternalDirectory("/outside/deny.ts", cwd);
    const resolver = makeResolver();
    resolver.resolvePathPolicy.mockImplementation(
      (values: readonly string[]) =>
        values.includes("/outside/deny.ts")
          ? makeCheckResult("deny")
          : makeCheckResult("ask"),
    );

    const { worstCheck } = selectUncoveredExternalPaths(
      [asked, denied],
      resolver,
      undefined,
    );

    expect(worstCheck?.state).toBe("deny");
  });
});
