import { describe, expect, test, vi } from "vitest";
import {
  ApprovalEscalator,
  ParentAuthorizer,
} from "#src/authority/approval-escalator";
import type { PermissionPromptDecision } from "#src/permission-dialog";
import {
  makeEscalatorDeps,
  makeForwarderContext,
  makeUiDecision,
} from "#test/helpers/forwarding-fixtures";
import { makeEvents } from "#test/helpers/handler-fixtures";

// ── requestApproval ────────────────────────────────────────────────────

describe("requestApproval — UI fast path", () => {
  test("calls requestPermissionDecisionFromUi but does not emit a UI prompt event (the prompter does)", async () => {
    const events = makeEvents();
    const requestPermissionDecisionFromUi = vi
      .fn()
      .mockResolvedValue(makeUiDecision());

    const escalator = new ApprovalEscalator(
      makeEscalatorDeps({ requestPermissionDecisionFromUi }),
    );

    await escalator.requestApproval(
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

    const escalator = new ApprovalEscalator(
      makeEscalatorDeps({ requestPermissionDecisionFromUi }),
    );

    const result = await escalator.requestApproval(
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

// ── ParentAuthorizer (Step 1 transitional wrapper, #555) ───────────────────
//
// Wraps an ApprovalEscalator instance, binding ctx once at construction.
// Step 2 folds the escalator's forwarding machinery directly into this
// class and removes this wrapper — these tests are expected to be replaced
// then, not carried forward unchanged.

describe("ParentAuthorizer", () => {
  test("delegates to escalator.requestApproval with the bound context and message", async () => {
    const escalator = {
      requestApproval: vi.fn().mockResolvedValue(makeUiDecision()),
    };
    const ctx = makeForwarderContext({ hasUI: false });
    const authorizer = new ParentAuthorizer(ctx, escalator);

    await authorizer.authorize({
      requestId: "req-1",
      source: "tool_call",
      agentName: "Explore",
      message: "Allow git push?",
      toolName: "bash",
      command: "git push",
    });

    expect(escalator.requestApproval).toHaveBeenCalledWith(
      ctx,
      "Allow git push?",
      undefined,
      { source: "tool_call", surface: "bash", value: "git push" },
    );
  });

  test("passes the sessionLabel option when present", async () => {
    const escalator = {
      requestApproval: vi.fn().mockResolvedValue(makeUiDecision()),
    };
    const authorizer = new ParentAuthorizer(
      makeForwarderContext({ hasUI: false }),
      escalator,
    );

    await authorizer.authorize({
      requestId: "req-2",
      source: "tool_call",
      agentName: "Explore",
      message: "Allow read?",
      toolName: "read",
      sessionLabel: "Yes, for 'read' tool",
    });

    expect(escalator.requestApproval).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      { sessionLabel: "Yes, for 'read' tool" },
      expect.anything(),
    );
  });

  test("returns the decision from escalator.requestApproval", async () => {
    const decision: PermissionPromptDecision = {
      approved: false,
      state: "denied",
    };
    const escalator = { requestApproval: vi.fn().mockResolvedValue(decision) };
    const authorizer = new ParentAuthorizer(
      makeForwarderContext({ hasUI: false }),
      escalator,
    );

    const result = await authorizer.authorize({
      requestId: "req-3",
      source: "tool_call",
      agentName: "Explore",
      message: "Allow read?",
      toolName: "read",
    });

    expect(result).toEqual(decision);
  });
});
