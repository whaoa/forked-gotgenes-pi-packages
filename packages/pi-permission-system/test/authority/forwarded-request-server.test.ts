import { afterEach, describe, expect, test, vi } from "vitest";
import { ForwardedRequestServer } from "#src/authority/forwarded-request-server";
import { DEFAULT_EXTENSION_CONFIG } from "#src/extension-config";
import {
  createForwardingTempDir,
  type ForwardingTempDir,
  makeForwarderContext,
  makeServerDeps,
  makeUiDecision,
} from "#test/helpers/forwarding-fixtures";
import { makeEvents } from "#test/helpers/handler-fixtures";

let temp: ForwardingTempDir | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
  vi.unstubAllEnvs();
});

describe("processInbox", () => {
  test("emits a UI prompt event before showing a forwarded permission dialog", async () => {
    temp = createForwardingTempDir("parent-session");
    temp.writeRequest({ id: "req-forwarded" });

    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue(makeUiDecision());

    const server = new ForwardedRequestServer(
      makeServerDeps({
        forwardingDir: temp.forwardingDir,
        events,
        requestPermissionDecisionFromUi,
      }),
    );

    await server.processInbox(
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

    const server = new ForwardedRequestServer(
      makeServerDeps({
        forwardingDir: temp.forwardingDir,
        events,
        requestPermissionDecisionFromUi,
      }),
    );

    await server.processInbox(
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

    const server = new ForwardedRequestServer(
      makeServerDeps({
        forwardingDir: temp.forwardingDir,
        events,
        requestPermissionDecisionFromUi,
        config: {
          current: () => ({ ...DEFAULT_EXTENSION_CONFIG, yoloMode: true }),
        },
      }),
    );

    await server.processInbox(
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

    const server = new ForwardedRequestServer(
      makeServerDeps({
        forwardingDir: temp.forwardingDir,
        logger,
        requestPermissionDecisionFromUi,
      }),
    );

    await server.processInbox(
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
