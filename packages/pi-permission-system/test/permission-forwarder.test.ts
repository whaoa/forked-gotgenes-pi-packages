import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_EXTENSION_CONFIG } from "#src/extension-config";
import { PermissionForwarder } from "#src/forwarded-permissions/permission-forwarder";
import {
  createForwardingTempDir,
  type ForwardingTempDir,
  makeForwarderContext,
  makeForwarderDeps,
  makeUiDecision,
} from "#test/helpers/forwarding-fixtures";
import { makeEvents } from "#test/helpers/handler-fixtures";

let temp: ForwardingTempDir | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
  vi.unstubAllEnvs();
});

// ── requestApproval ───────────────────────────────────────────────────────

describe("requestApproval — UI fast path", () => {
  test("calls requestPermissionDecisionFromUi but does not emit a UI prompt event (the prompter does)", async () => {
    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue(makeUiDecision());

    const forwarder = new PermissionForwarder(
      makeForwarderDeps({ events, requestPermissionDecisionFromUi }),
    );

    await forwarder.requestApproval(
      makeForwarderContext({ hasUI: true }),
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
    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi.fn();

    const forwarder = new PermissionForwarder(
      makeForwarderDeps({ events, requestPermissionDecisionFromUi }),
    );

    const result = await forwarder.requestApproval(
      makeForwarderContext({ hasUI: false }),
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
    temp = createForwardingTempDir("parent-session");
    temp.writeRequest({ id: "req-forwarded" });

    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue(makeUiDecision());

    const forwarder = new PermissionForwarder(
      makeForwarderDeps({
        forwardingDir: temp.forwardingDir,
        events,
        requestPermissionDecisionFromUi,
      }),
    );

    await forwarder.processInbox(
      makeForwarderContext({ hasUI: true, sessionId: "parent-session" }),
    );

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
  });

  test("emits a non-degraded UI prompt event when the request carries display fields", async () => {
    temp = createForwardingTempDir("parent-session");
    temp.writeRequest({
      id: "req-forwarded-rich",
      source: "tool_call",
      surface: "bash",
      value: "git push",
    });

    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue(makeUiDecision());

    const forwarder = new PermissionForwarder(
      makeForwarderDeps({
        forwardingDir: temp.forwardingDir,
        events,
        requestPermissionDecisionFromUi,
      }),
    );

    await forwarder.processInbox(
      makeForwarderContext({ hasUI: true, sessionId: "parent-session" }),
    );

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
  });

  test("does not emit a UI prompt event when forwarded permission auto-approves", async () => {
    temp = createForwardingTempDir("parent-session");
    temp.writeRequest({ id: "req-forwarded-auto" });

    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi.fn();

    const forwarder = new PermissionForwarder(
      makeForwarderDeps({
        forwardingDir: temp.forwardingDir,
        events,
        requestPermissionDecisionFromUi,
        config: {
          current: () => ({ ...DEFAULT_EXTENSION_CONFIG, yoloMode: true }),
        },
      }),
    );

    await forwarder.processInbox(
      makeForwarderContext({ hasUI: true, sessionId: "parent-session" }),
    );

    expect(events.emit).not.toHaveBeenCalledWith(
      "permissions:ui_prompt",
      expect.anything(),
    );
    expect(requestPermissionDecisionFromUi).not.toHaveBeenCalled();
  });

  test("recreates a missing responses/ directory and still writes the response", async () => {
    // Simulate the race: requests/ exists with a pending file, but
    // responses/ was removed by a concurrent cleanup pass.
    temp = createForwardingTempDir("parent-session", {
      createResponsesDir: false,
    });
    temp.writeRequest({ id: "req-race", message: "Allow read?" });

    const logger = { review: vi.fn(), debug: vi.fn() };
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue(makeUiDecision());

    const forwarder = new PermissionForwarder(
      makeForwarderDeps({
        forwardingDir: temp.forwardingDir,
        logger,
        requestPermissionDecisionFromUi,
      }),
    );

    await forwarder.processInbox(
      makeForwarderContext({ hasUI: true, sessionId: "parent-session" }),
    );

    // processInbox must have recreated responses/ and written a response
    // file — no permission_forwarding.error should have been logged.
    expect(logger.review).not.toHaveBeenCalledWith(
      "permission_forwarding.error",
      expect.anything(),
    );
    expect(requestPermissionDecisionFromUi).toHaveBeenCalled();
  });
});
