/**
 * Unit tests for PromptingGateway.
 *
 * The gateway owns the stored ExtensionContext and is the sole implementation
 * of the GatePrompter role. These tests exercise canConfirm() across all
 * policy permutations and verify the prompt/reject contract for promptPermission().
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SubagentDetector } from "#src/authority/subagent-detection";
import type { PermissionPromptDecision } from "#src/permission-dialog";
import type {
  PermissionPrompterApi,
  PromptPermissionDetails,
} from "#src/permission-prompter";
import {
  PromptingGateway,
  type PromptingGatewayDeps,
} from "#src/prompting-gateway";

// ── Test helpers ──────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
  return {
    cwd: "/test/project",
    hasUI: true,
    ui: {
      setStatus: vi.fn(),
      notify: vi.fn(),
      select: vi.fn(),
      input: vi.fn(),
    },
    sessionManager: {
      getEntries: vi.fn().mockReturnValue([]),
      getSessionDir: vi.fn().mockReturnValue("/sessions/test"),
      getSessionId: vi.fn().mockReturnValue(null),
      addEntry: vi.fn(),
    },
    ...overrides,
  } as unknown as ExtensionContext;
}

function makePrompterApi(): PermissionPrompterApi & {
  prompt: ReturnType<typeof vi.fn>;
} {
  return {
    prompt: vi
      .fn<PermissionPrompterApi["prompt"]>()
      .mockResolvedValue({ approved: true, state: "approved" }),
  };
}

function makeDetails(): PromptPermissionDetails {
  return {
    requestId: "req-1",
    source: "tool_call",
    agentName: null,
    message: "Allow this?",
  };
}

function makeDetection(isSubagent = false): SubagentDetector {
  return { isSubagent: vi.fn(() => isSubagent) };
}

function makeDeps(
  overrides: Partial<PromptingGatewayDeps> = {},
): PromptingGatewayDeps {
  return {
    detection: overrides.detection ?? makeDetection(),
    prompter: overrides.prompter ?? makePrompterApi(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("PromptingGateway", () => {
  describe("canConfirm", () => {
    it("returns false before activate", () => {
      const gateway = new PromptingGateway(makeDeps());
      expect(gateway.canConfirm()).toBe(false);
    });

    it("returns true after activate when context has UI", () => {
      const gateway = new PromptingGateway(makeDeps());
      gateway.activate(makeCtx({ hasUI: true }));
      expect(gateway.canConfirm()).toBe(true);
    });

    it("returns false when context has no UI and is not a subagent", () => {
      const gateway = new PromptingGateway(makeDeps());
      gateway.activate(makeCtx({ hasUI: false }));
      expect(gateway.canConfirm()).toBe(false);
    });

    it("returns true when the detector reports a subagent context", () => {
      const gateway = new PromptingGateway(
        makeDeps({ detection: makeDetection(true) }),
      );
      gateway.activate(makeCtx({ hasUI: false }));
      expect(gateway.canConfirm()).toBe(true);
    });

    it("returns false after deactivate", () => {
      const gateway = new PromptingGateway(makeDeps());
      gateway.activate(makeCtx({ hasUI: true }));
      gateway.deactivate();
      expect(gateway.canConfirm()).toBe(false);
    });

    it("returns true after re-activate following deactivate", () => {
      const gateway = new PromptingGateway(makeDeps());
      gateway.activate(makeCtx({ hasUI: true }));
      gateway.deactivate();
      gateway.activate(makeCtx({ hasUI: true }));
      expect(gateway.canConfirm()).toBe(true);
    });
  });

  describe("prompt", () => {
    it("rejects before activate", async () => {
      const gateway = new PromptingGateway(makeDeps());
      await expect(gateway.prompt(makeDetails())).rejects.toThrow(
        "prompt called before the session was activated",
      );
    });

    it("delegates to deps.prompter.prompt with the stored context", async () => {
      const prompter = makePrompterApi();
      const gateway = new PromptingGateway(makeDeps({ prompter }));
      const ctx = makeCtx();
      gateway.activate(ctx);
      const details = makeDetails();

      const result = await gateway.prompt(details);

      expect(prompter.prompt).toHaveBeenCalledWith(ctx, details);
      expect(result).toEqual({ approved: true, state: "approved" });
    });

    it("uses the most recently activated context", async () => {
      const prompter = makePrompterApi();
      const gateway = new PromptingGateway(makeDeps({ prompter }));
      const firstCtx = makeCtx({ cwd: "/first" });
      const secondCtx = makeCtx({ cwd: "/second" });

      gateway.activate(firstCtx);
      gateway.activate(secondCtx);

      await gateway.prompt(makeDetails());

      expect(prompter.prompt).toHaveBeenCalledWith(
        secondCtx,
        expect.anything(),
      );
    });

    it("rejects after deactivate", async () => {
      const gateway = new PromptingGateway(makeDeps());
      gateway.activate(makeCtx());
      gateway.deactivate();
      await expect(gateway.prompt(makeDetails())).rejects.toThrow(
        "prompt called before the session was activated",
      );
    });

    it("returns the prompter decision", async () => {
      const decision: PermissionPromptDecision = {
        approved: false,
        state: "denied",
        denialReason: "user declined",
      };
      const prompter = makePrompterApi();
      prompter.prompt.mockResolvedValue(decision);
      const gateway = new PromptingGateway(makeDeps({ prompter }));
      gateway.activate(makeCtx());

      const result = await gateway.prompt(makeDetails());

      expect(result).toEqual(decision);
    });
  });

  describe("lifecycle", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("activate then deactivate clears the stored context", () => {
      const gateway = new PromptingGateway(makeDeps());
      gateway.activate(makeCtx());
      gateway.deactivate();
      expect(gateway.canConfirm()).toBe(false);
    });

    it("multiple activate calls update the stored context", () => {
      const prompter = makePrompterApi();
      const gateway = new PromptingGateway(makeDeps({ prompter }));
      const ctx2 = makeCtx({ cwd: "/new" });
      gateway.activate(makeCtx({ cwd: "/old" }));
      gateway.activate(ctx2);

      // canConfirm still works (context set)
      expect(gateway.canConfirm()).toBe(true);
    });
  });
});
