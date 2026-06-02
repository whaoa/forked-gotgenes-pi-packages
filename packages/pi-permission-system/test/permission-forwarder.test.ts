import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  PermissionForwarder,
  type PermissionForwarderDeps,
} from "#src/forwarded-permissions/permission-forwarder";
import { createPermissionForwardingLocation } from "#src/permission-forwarding";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeDeps(
  overrides: Partial<PermissionForwarderDeps> = {},
): PermissionForwarderDeps {
  return {
    forwardingDir: "/tmp/forwarding",
    subagentSessionsDir: "/tmp/subagents",
    logger: { writeReviewLog: vi.fn(), writeDebugLog: vi.fn() },
    writeReviewLog: vi.fn(),
    requestPermissionDecisionFromUi: vi
      .fn()
      .mockResolvedValue({ approved: true, state: "approved" as const }),
    shouldAutoApprove: () => false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── requestApproval ───────────────────────────────────────────────────────

describe("requestApproval — UI fast path", () => {
  test("calls requestPermissionDecisionFromUi but does not emit a UI prompt event (the prompter does)", async () => {
    const events = {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue(() => undefined),
    };
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue({ approved: true, state: "approved" as const });

    const forwarder = new PermissionForwarder(
      makeDeps({ events, requestPermissionDecisionFromUi }),
    );

    await forwarder.requestApproval(
      {
        hasUI: true,
        ui: { select: vi.fn(), input: vi.fn() },
      } as unknown as ExtensionContext,
      "Allow git push?",
    );

    expect(requestPermissionDecisionFromUi).toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalledWith(
      "permissions:ui_prompt",
      expect.anything(),
    );
  });
});

describe("requestApproval — non-UI, non-subagent path", () => {
  test("returns denied without showing a dialog or emitting when there is no active UI", async () => {
    const events = {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue(() => undefined),
    };
    const requestPermissionDecisionFromUi = vi.fn();

    const forwarder = new PermissionForwarder(
      makeDeps({ events, requestPermissionDecisionFromUi }),
    );

    const result = await forwarder.requestApproval(
      {
        hasUI: false,
        sessionManager: {
          getSessionDir: vi.fn().mockReturnValue(null),
        },
      } as unknown as ExtensionContext,
      "Allow git push?",
    );

    expect(result).toEqual({ approved: false, state: "denied" });
    expect(events.emit).not.toHaveBeenCalledWith(
      "permissions:ui_prompt",
      expect.anything(),
    );
    expect(requestPermissionDecisionFromUi).not.toHaveBeenCalled();
  });
});

// ── processInbox ──────────────────────────────────────────────────────────

describe("processInbox", () => {
  test("emits a UI prompt event before showing a forwarded permission dialog", async () => {
    const root = mkdtempSync(join(tmpdir(), "permission-forwarding-"));
    try {
      const forwardingDir = join(root, "forwarding");
      const location = createPermissionForwardingLocation(
        forwardingDir,
        "parent-session",
      );
      mkdirSync(location.requestsDir, { recursive: true });
      mkdirSync(location.responsesDir, { recursive: true });
      writeFileSync(
        join(location.requestsDir, "req-forwarded.json"),
        JSON.stringify({
          id: "req-forwarded",
          createdAt: Date.now(),
          requesterSessionId: "child-session",
          targetSessionId: "parent-session",
          requesterAgentName: "Explore",
          message: "Allow git push?",
        }),
        "utf-8",
      );

      const events = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
      };
      const requestPermissionDecisionFromUi = vi
        .fn()
        .mockResolvedValue({ approved: true, state: "approved" as const });

      const forwarder = new PermissionForwarder(
        makeDeps({
          forwardingDir,
          events,
          requestPermissionDecisionFromUi,
        }),
      );

      await forwarder.processInbox({
        hasUI: true,
        ui: { select: vi.fn(), input: vi.fn() },
        sessionManager: {
          getSessionId: vi.fn().mockReturnValue("parent-session"),
        },
      } as unknown as ExtensionContext);

      expect(events.emit).toHaveBeenCalledWith(
        "permissions:ui_prompt",
        expect.objectContaining({
          requestId: "req-forwarded",
          source: "tool_call",
          surface: null,
          value: null,
          agentName: "Explore",
          message: expect.stringContaining("Allow git push?"),
          forwarding: {
            requesterAgentName: "Explore",
            requesterSessionId: "child-session",
          },
        }),
      );
      expect(requestPermissionDecisionFromUi).toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("emits a non-degraded UI prompt event when the request carries display fields", async () => {
    const root = mkdtempSync(join(tmpdir(), "permission-forwarding-"));
    try {
      const forwardingDir = join(root, "forwarding");
      const location = createPermissionForwardingLocation(
        forwardingDir,
        "parent-session",
      );
      mkdirSync(location.requestsDir, { recursive: true });
      mkdirSync(location.responsesDir, { recursive: true });
      writeFileSync(
        join(location.requestsDir, "req-forwarded-rich.json"),
        JSON.stringify({
          id: "req-forwarded-rich",
          createdAt: Date.now(),
          requesterSessionId: "child-session",
          targetSessionId: "parent-session",
          requesterAgentName: "Explore",
          message: "Allow git push?",
          source: "tool_call",
          surface: "bash",
          value: "git push",
        }),
        "utf-8",
      );

      const events = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
      };
      const requestPermissionDecisionFromUi = vi
        .fn()
        .mockResolvedValue({ approved: true, state: "approved" as const });

      const forwarder = new PermissionForwarder(
        makeDeps({
          forwardingDir,
          events,
          requestPermissionDecisionFromUi,
        }),
      );

      await forwarder.processInbox({
        hasUI: true,
        ui: { select: vi.fn(), input: vi.fn() },
        sessionManager: {
          getSessionId: vi.fn().mockReturnValue("parent-session"),
        },
      } as unknown as ExtensionContext);

      expect(events.emit).toHaveBeenCalledWith(
        "permissions:ui_prompt",
        expect.objectContaining({
          requestId: "req-forwarded-rich",
          source: "tool_call",
          surface: "bash",
          value: "git push",
          agentName: "Explore",
          message: expect.stringContaining("Allow git push?"),
          forwarding: {
            requesterAgentName: "Explore",
            requesterSessionId: "child-session",
          },
        }),
      );
      expect(requestPermissionDecisionFromUi).toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not emit a UI prompt event when forwarded permission auto-approves", async () => {
    const root = mkdtempSync(join(tmpdir(), "permission-forwarding-"));
    try {
      const forwardingDir = join(root, "forwarding");
      const location = createPermissionForwardingLocation(
        forwardingDir,
        "parent-session",
      );
      mkdirSync(location.requestsDir, { recursive: true });
      mkdirSync(location.responsesDir, { recursive: true });
      writeFileSync(
        join(location.requestsDir, "req-forwarded-auto.json"),
        JSON.stringify({
          id: "req-forwarded-auto",
          createdAt: Date.now(),
          requesterSessionId: "child-session",
          targetSessionId: "parent-session",
          requesterAgentName: "Explore",
          message: "Allow git push?",
        }),
        "utf-8",
      );

      const events = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
      };
      const requestPermissionDecisionFromUi = vi.fn();

      const forwarder = new PermissionForwarder(
        makeDeps({
          forwardingDir,
          events,
          requestPermissionDecisionFromUi,
          shouldAutoApprove: () => true,
        }),
      );

      await forwarder.processInbox({
        hasUI: true,
        ui: { select: vi.fn(), input: vi.fn() },
        sessionManager: {
          getSessionId: vi.fn().mockReturnValue("parent-session"),
        },
      } as unknown as ExtensionContext);

      expect(events.emit).not.toHaveBeenCalledWith(
        "permissions:ui_prompt",
        expect.anything(),
      );
      expect(requestPermissionDecisionFromUi).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
