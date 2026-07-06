import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Injected mock ───────────────────────────────────────────────────────────

const mockRequestApproval = vi.fn();

// ── Imports ─────────────────────────────────────────────────────────────────

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PermissionPromptDecision } from "#src/permission-dialog";
import type { PromptPermissionDetails } from "#src/permission-prompter";
import {
  PermissionPrompter,
  type PermissionPrompterDeps,
} from "#src/permission-prompter";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(hasUI: boolean): ExtensionContext {
  return {
    hasUI,
    ui: { select: vi.fn(), input: vi.fn() },
    sessionManager: { getSessionDir: vi.fn().mockReturnValue(null) },
  } as unknown as ExtensionContext;
}

function makeDetails(
  overrides?: Partial<PromptPermissionDetails>,
): PromptPermissionDetails {
  return {
    requestId: "req-123",
    source: "tool_call",
    agentName: "test-agent",
    message: "Allow read?",
    toolName: "read",
    ...overrides,
  };
}

function makeDeps(
  overrides?: Partial<PermissionPrompterDeps>,
): PermissionPrompterDeps {
  return {
    logger: { review: vi.fn() },
    events: { emit: vi.fn(), on: vi.fn().mockReturnValue(() => undefined) },
    forwarder: { requestApproval: mockRequestApproval },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PermissionPrompter", () => {
  beforeEach(() => {
    mockRequestApproval.mockReset();
    mockRequestApproval.mockResolvedValue({
      approved: true,
      state: "approved",
    });
  });

  describe("prompt flow (UI present)", () => {
    it("logs permission_request.waiting before calling confirmPermission", async () => {
      const logger = { review: vi.fn() };
      const approved: PermissionPromptDecision = {
        approved: true,
        state: "approved",
      };
      mockRequestApproval.mockResolvedValue(approved);
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(true), makeDetails());

      const calls = logger.review.mock.calls.map((c) => c[0] as string);
      expect(
        calls.indexOf("permission_request.waiting"),
      ).toBeGreaterThanOrEqual(0);
      expect(calls.indexOf("permission_request.waiting")).toBeLessThan(
        calls.indexOf("permission_request.approved"),
      );
    });

    it("emits a UI prompt event with normalized surface and value when the session has UI", async () => {
      const events = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
      };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ events });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(
        makeCtx(true),
        makeDetails({
          toolName: "bash",
          command: "git push",
          toolInputPreview: "git push",
        }),
      );

      expect(events.emit).toHaveBeenCalledWith("permissions:ui_prompt", {
        requestId: "req-123",
        source: "tool_call",
        surface: "bash",
        value: "git push",
        agentName: "test-agent",
        message: "Allow read?",
        forwarding: null,
      });
    });

    it("normalizes skill UI prompt events to the skill surface", async () => {
      const events = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
      };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ events });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(
        makeCtx(true),
        makeDetails({
          source: "skill_input",
          toolName: undefined,
          skillName: "deploy-helper",
        }),
      );

      expect(events.emit).toHaveBeenCalledWith("permissions:ui_prompt", {
        requestId: "req-123",
        source: "skill_input",
        surface: "skill",
        value: "deploy-helper",
        agentName: "test-agent",
        message: "Allow read?",
        forwarding: null,
      });
    });

    it("does not emit a UI prompt event when the session has no UI", async () => {
      const events = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
      };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ events });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(false), makeDetails());

      expect(events.emit).not.toHaveBeenCalledWith(
        "permissions:ui_prompt",
        expect.anything(),
      );
    });

    it("logs permission_request.approved when confirmPermission returns approved", async () => {
      const logger = { review: vi.fn() };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(true), makeDetails());

      expect(logger.review).toHaveBeenCalledWith(
        "permission_request.approved",
        expect.objectContaining({
          requestId: "req-123",
          resolution: "approved",
        }),
      );
    });

    it("logs permission_request.denied when confirmPermission returns denied", async () => {
      const logger = { review: vi.fn() };
      mockRequestApproval.mockResolvedValue({
        approved: false,
        state: "denied",
      });
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(true), makeDetails());

      expect(logger.review).toHaveBeenCalledWith(
        "permission_request.denied",
        expect.objectContaining({
          requestId: "req-123",
          resolution: "denied",
        }),
      );
    });

    it("logs permission_request.denied with denialReason when present", async () => {
      const logger = { review: vi.fn() };
      mockRequestApproval.mockResolvedValue({
        approved: false,
        state: "denied_with_reason",
        denialReason: "too sensitive",
      });
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(true), makeDetails());

      expect(logger.review).toHaveBeenCalledWith(
        "permission_request.denied",
        expect.objectContaining({
          denialReason: "too sensitive",
        }),
      );
    });

    it("returns the decision from confirmPermission", async () => {
      const decision: PermissionPromptDecision = {
        approved: false,
        state: "denied_with_reason",
        denialReason: "sensitive",
      };
      mockRequestApproval.mockResolvedValue(decision);
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);

      const result = await prompter.prompt(makeCtx(true), makeDetails());

      expect(result).toEqual(decision);
    });

    it("passes sessionLabel option to confirmPermission when present", async () => {
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);
      const details = makeDetails({ sessionLabel: "Yes, for 'read' tool" });

      await prompter.prompt(makeCtx(true), details);

      expect(mockRequestApproval).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        { sessionLabel: "Yes, for 'read' tool" },
        { source: "tool_call", surface: "read", value: "read" },
      );
    });

    it("passes the display fields (source/surface/value) to confirmPermission", async () => {
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);
      const details = makeDetails({
        toolName: "bash",
        command: "git push",
      });

      await prompter.prompt(makeCtx(false), details);

      expect(mockRequestApproval).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        undefined,
        { source: "tool_call", surface: "bash", value: "git push" },
      );
    });

    it("passes undefined options to confirmPermission when sessionLabel is absent", async () => {
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(true), makeDetails());

      expect(mockRequestApproval).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        undefined,
        { source: "tool_call", surface: "read", value: "read" },
      );
    });

    it("passes the message from details to confirmPermission", async () => {
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);
      const details = makeDetails({ message: "Allow bash: git status?" });

      await prompter.prompt(makeCtx(true), details);

      expect(mockRequestApproval).toHaveBeenCalledWith(
        expect.anything(),
        "Allow bash: git status?",
        undefined,
        { source: "tool_call", surface: "read", value: "read" },
      );
    });
  });

  // ── Review log field coverage ────────────────────────────────────────────

  describe("review log fields", () => {
    it("includes all standard fields in the waiting log entry", async () => {
      const logger = { review: vi.fn() };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);
      const details = makeDetails({
        toolCallId: "tc-1",
        skillName: "librarian",
        path: "/src/foo.ts",
        command: "git status",
        target: "server:tool",
        toolInputPreview: "{ path: '...' }",
      });

      await prompter.prompt(makeCtx(true), details);

      expect(logger.review).toHaveBeenCalledWith(
        "permission_request.waiting",
        expect.objectContaining({
          requestId: "req-123",
          source: "tool_call",
          agentName: "test-agent",
          message: "Allow read?",
          toolCallId: "tc-1",
          toolName: "read",
          skillName: "librarian",
          path: "/src/foo.ts",
          command: "git status",
          target: "server:tool",
          toolInputPreview: "{ path: '...' }",
        }),
      );
    });

    it("uses null for optional fields not present in details", async () => {
      const logger = { review: vi.fn() };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(true), makeDetails());

      expect(logger.review).toHaveBeenCalledWith(
        "permission_request.waiting",
        expect.objectContaining({
          toolCallId: null,
          skillName: null,
          path: null,
          command: null,
          target: null,
          toolInputPreview: null,
        }),
      );
    });
  });

  // ── Subagent forwarding path ─────────────────────────────────────────────

  describe("subagent forwarding path", () => {
    it("calls confirmPermission even when ctx has no UI", async () => {
      const forwarded: PermissionPromptDecision = {
        approved: true,
        state: "approved",
      };
      mockRequestApproval.mockResolvedValue(forwarded);
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(false), makeDetails());

      expect(mockRequestApproval).toHaveBeenCalled();
    });

    it("returns the decision from confirmPermission in the subagent path", async () => {
      const forwarded: PermissionPromptDecision = {
        approved: false,
        state: "denied",
      };
      mockRequestApproval.mockResolvedValue(forwarded);
      const deps = makeDeps();
      const prompter = new PermissionPrompter(deps);

      const result = await prompter.prompt(makeCtx(false), makeDetails());

      expect(result).toEqual(forwarded);
    });

    it("logs the outcome when confirmPermission resolves via forwarding", async () => {
      const logger = { review: vi.fn() };
      mockRequestApproval.mockResolvedValue({
        approved: true,
        state: "approved",
      });
      const deps = makeDeps({ logger });
      const prompter = new PermissionPrompter(deps);

      await prompter.prompt(makeCtx(false), makeDetails());

      expect(logger.review).toHaveBeenCalledWith(
        "permission_request.approved",
        expect.objectContaining({ requestId: "req-123" }),
      );
    });
  });
});
