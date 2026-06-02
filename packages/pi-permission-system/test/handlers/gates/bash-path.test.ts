import { afterEach, describe, expect, it, vi } from "vitest";

// Mock node:os so tilde-expansion is deterministic across platforms.
vi.mock("node:os", () => {
  const homedir = vi.fn(() => "/mock/home");
  return {
    homedir,
    default: { homedir },
  };
});

import { getNonEmptyString, toRecord } from "#src/common";
import { describeBashPathGate } from "#src/handlers/gates/bash-path";
import { BashProgram } from "#src/handlers/gates/bash-program";
import type {
  GateBypass,
  GateDescriptor,
  GateResult,
} from "#src/handlers/gates/descriptor";
import { isGateBypass, isGateDescriptor } from "#src/handlers/gates/descriptor";
import type { ToolCallContext } from "#src/handlers/gates/types";
import type { PermissionResolver } from "#src/permission-resolver";

import {
  makeGateCheckResult as makeCheckResult,
  makeResolver,
  makeTcc,
} from "#test/helpers/gate-fixtures";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mirror the handler's parse-once derivation: parse the bash command into a
 * shared `BashProgram` and inject it, exactly as `permission-gate-handler.ts`
 * does, so the gate is exercised through the production wiring.
 */
async function describeGate(
  tcc: ToolCallContext,
  resolver: PermissionResolver,
): Promise<GateResult> {
  const command = getNonEmptyString(toRecord(tcc.input).command);
  const bashProgram =
    tcc.toolName === "bash" && command
      ? await BashProgram.parse(command)
      : null;
  return describeBashPathGate(tcc, bashProgram, resolver);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("describeBashPathGate", () => {
  it("returns null for non-bash tools", async () => {
    const result = await describeGate(
      makeTcc({ toolName: "read", input: { path: ".env" } }),
      makeResolver(),
    );
    expect(result).toBeNull();
  });

  it("returns null when no tokens are extracted", async () => {
    const result = await describeGate(
      makeTcc({ input: { command: "echo hello" } }),
      makeResolver(),
    );
    expect(result).toBeNull();
  });

  it("returns null when all tokens evaluate to allow", async () => {
    const result = await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(makeCheckResult({ state: "allow" })),
    );
    expect(result).toBeNull();
  });

  it("returns GateDescriptor when a token evaluates to deny", async () => {
    const result = await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(makeCheckResult({ state: "deny", matchedPattern: "*.env" })),
    );
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    const desc = result as GateDescriptor;
    expect(desc.surface).toBe("path");
    expect(desc.preCheck?.state).toBe("deny");
  });

  it("returns GateDescriptor when a token evaluates to ask", async () => {
    const result = await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(makeCheckResult({ state: "ask", matchedPattern: "*" })),
    );
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    const desc = result as GateDescriptor;
    expect(desc.preCheck?.state).toBe("ask");
  });

  it("descriptor includes triggering token in prompt message", async () => {
    const result = (await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(makeCheckResult({ state: "deny", matchedPattern: "*.env" })),
    )) as GateDescriptor;
    expect(result.denialContext).toMatchObject({
      kind: "bash_path",
      command: "cat .env",
      pathValue: ".env",
    });
    expect(result.promptDetails.message).toContain(".env");
  });

  it("descriptor decision uses surface 'path'", async () => {
    const result = (await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(makeCheckResult({ state: "deny", matchedPattern: "*.env" })),
    )) as GateDescriptor;
    expect(result.decision.surface).toBe("path");
  });

  it("returns GateBypass when session rule covers the path", async () => {
    const result = await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(makeCheckResult({ state: "allow", source: "session" })),
    );
    expect(result).not.toBeNull();
    expect(isGateBypass(result)).toBe(true);
    expect((result as GateBypass).action).toBe("allow");
  });

  it("returns null when command is missing", async () => {
    const result = await describeGate(makeTcc({ input: {} }), makeResolver());
    expect(result).toBeNull();
  });

  it("evaluates most restrictive across multiple tokens", async () => {
    const resolver = makeResolver();
    resolver.resolve.mockImplementation((_surface, input) => {
      const record = input as Record<string, unknown>;
      if (record.path === "src/foo.ts") {
        return makeCheckResult({ state: "allow" });
      }
      return makeCheckResult({ state: "deny", matchedPattern: "*.env" });
    });
    const result = await describeGate(
      makeTcc({ input: { command: "cat src/foo.ts .env" } }),
      resolver,
    );
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    expect((result as GateDescriptor).preCheck?.state).toBe("deny");
  });

  it("deny wins in multi-token: cp .env README.md", async () => {
    const resolver = makeResolver();
    resolver.resolve.mockImplementation((_surface, input) => {
      const record = input as Record<string, unknown>;
      if (record.path === ".env") {
        return makeCheckResult({ state: "deny", matchedPattern: "*.env" });
      }
      return makeCheckResult({ state: "allow" });
    });
    const result = await describeGate(
      makeTcc({ input: { command: "cp .env README.md" } }),
      resolver,
    );
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    const desc = result as GateDescriptor;
    expect(desc.preCheck?.state).toBe("deny");
    expect(desc.decision.value).toBe(".env");
  });

  it("extracts redirect target: echo test > .env triggers deny", async () => {
    const resolver = makeResolver();
    resolver.resolve.mockImplementation((_surface, input) => {
      const record = input as Record<string, unknown>;
      if (record.path === ".env") {
        return makeCheckResult({ state: "deny", matchedPattern: "*.env" });
      }
      return makeCheckResult({ state: "allow" });
    });
    const result = await describeGate(
      makeTcc({ input: { command: "echo test > .env" } }),
      resolver,
    );
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    expect((result as GateDescriptor).preCheck?.state).toBe("deny");
  });

  it("returns null when all tokens match only the universal default", async () => {
    const result = await describeGate(
      makeTcc({ input: { command: "cat .env" } }),
      makeResolver(
        makeCheckResult({
          state: "ask",
          matchedPattern: undefined,
          source: "special",
          origin: "builtin",
        }),
      ),
    );
    expect(result).toBeNull();
  });

  it("ignores tokens matching universal default but fires for explicit rule matches", async () => {
    const resolver = makeResolver();
    resolver.resolve.mockImplementation((_surface, input) => {
      const record = input as Record<string, unknown>;
      if (record.path === ".env") {
        return makeCheckResult({
          state: "deny",
          matchedPattern: "*.env",
        });
      }
      // Other tokens match only the universal default
      return makeCheckResult({
        state: "ask",
        matchedPattern: undefined,
        source: "special",
        origin: "builtin",
      });
    });
    const result = await describeGate(
      makeTcc({ input: { command: "cat src/foo.ts .env" } }),
      resolver,
    );
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    const desc = result as GateDescriptor;
    expect(desc.preCheck?.state).toBe("deny");
    expect(desc.decision.value).toBe(".env");
  });
});
