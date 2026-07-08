/**
 * Unit tests for AuthorizerSelection.
 *
 * AuthorizerSelection owns the stored ExtensionContext and is the sole
 * implementation of the GatePrompter role. These tests exercise canConfirm()
 * across all policy permutations and verify the prompt/reject contract.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import type { AuthorizerSelectionDeps as SelectionCtorDeps } from "#src/authority/authorizer";
import { AuthorizerSelection } from "#src/authority/authorizer-selection";
import { LocalUserAuthorizer } from "#src/authority/local-user-authorizer";
import type {
  PermissionPrompterApi,
  PromptPermissionDetails,
} from "#src/authority/permission-prompter";
import type { SubagentDetector } from "#src/authority/subagent-detection";
import type { PermissionPromptDecision } from "#src/permission-dialog";

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

type SelectionDeps = SelectionCtorDeps & { prompter: PermissionPrompterApi };

function makeDeps(overrides: Partial<SelectionDeps> = {}): SelectionDeps {
  return {
    detection: overrides.detection ?? makeDetection(),
    events: overrides.events ?? {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue(() => undefined),
    },
    requestPermissionDecisionFromUi:
      overrides.requestPermissionDecisionFromUi ??
      vi.fn().mockResolvedValue({ approved: true, state: "approved" }),
    escalator: overrides.escalator ?? {
      requestApproval: vi
        .fn()
        .mockResolvedValue({ approved: false, state: "denied" }),
    },
    prompter: overrides.prompter ?? makePrompterApi(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("AuthorizerSelection", () => {
  describe("canConfirm", () => {
    it("returns false before activate", () => {
      const selection = new AuthorizerSelection(makeDeps());
      expect(selection.canConfirm()).toBe(false);
    });

    it("returns true after activate when context has UI", () => {
      const selection = new AuthorizerSelection(makeDeps());
      selection.activate(makeCtx({ hasUI: true }));
      expect(selection.canConfirm()).toBe(true);
    });

    it("returns false when context has no UI and is not a subagent", () => {
      const selection = new AuthorizerSelection(makeDeps());
      selection.activate(makeCtx({ hasUI: false }));
      expect(selection.canConfirm()).toBe(false);
    });

    it("returns true when the detector reports a subagent context", () => {
      const selection = new AuthorizerSelection(
        makeDeps({ detection: makeDetection(true) }),
      );
      selection.activate(makeCtx({ hasUI: false }));
      expect(selection.canConfirm()).toBe(true);
    });

    it("returns false after deactivate", () => {
      const selection = new AuthorizerSelection(makeDeps());
      selection.activate(makeCtx({ hasUI: true }));
      selection.deactivate();
      expect(selection.canConfirm()).toBe(false);
    });

    it("returns true after re-activate following deactivate", () => {
      const selection = new AuthorizerSelection(makeDeps());
      selection.activate(makeCtx({ hasUI: true }));
      selection.deactivate();
      selection.activate(makeCtx({ hasUI: true }));
      expect(selection.canConfirm()).toBe(true);
    });
  });

  describe("prompt", () => {
    it("rejects before activate", async () => {
      const selection = new AuthorizerSelection(makeDeps());
      await expect(selection.prompt(makeDetails())).rejects.toThrow(
        "prompt called before the session was activated",
      );
    });

    it("delegates to deps.prompter.prompt with the selected authorizer", async () => {
      const prompter = makePrompterApi();
      const selection = new AuthorizerSelection(makeDeps({ prompter }));
      const ctx = makeCtx({ hasUI: true });
      selection.activate(ctx);
      const details = makeDetails();

      const result = await selection.prompt(details);

      expect(prompter.prompt).toHaveBeenCalledWith(
        expect.any(LocalUserAuthorizer),
        details,
      );
      expect(result).toEqual({ approved: true, state: "approved" });
    });

    it("uses the most recently selected authorizer", async () => {
      const prompter = makePrompterApi();
      const selection = new AuthorizerSelection(makeDeps({ prompter }));
      selection.activate(makeCtx({ hasUI: false }));
      selection.activate(makeCtx({ hasUI: true }));

      await selection.prompt(makeDetails());

      expect(prompter.prompt).toHaveBeenCalledWith(
        expect.any(LocalUserAuthorizer),
        expect.anything(),
      );
    });

    it("rejects after deactivate", async () => {
      const selection = new AuthorizerSelection(makeDeps());
      selection.activate(makeCtx());
      selection.deactivate();
      await expect(selection.prompt(makeDetails())).rejects.toThrow(
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
      const selection = new AuthorizerSelection(makeDeps({ prompter }));
      selection.activate(makeCtx());

      const result = await selection.prompt(makeDetails());

      expect(result).toEqual(decision);
    });
  });

  describe("lifecycle", () => {
    it("activate then deactivate clears the stored context", () => {
      const selection = new AuthorizerSelection(makeDeps());
      selection.activate(makeCtx());
      selection.deactivate();
      expect(selection.canConfirm()).toBe(false);
    });

    it("multiple activate calls update the stored context", () => {
      const prompter = makePrompterApi();
      const selection = new AuthorizerSelection(makeDeps({ prompter }));
      const ctx2 = makeCtx({ cwd: "/new" });
      selection.activate(makeCtx({ cwd: "/old" }));
      selection.activate(ctx2);

      expect(selection.canConfirm()).toBe(true);
    });
  });
});
