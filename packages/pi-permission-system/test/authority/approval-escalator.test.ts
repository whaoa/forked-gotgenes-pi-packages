import { describe, expect, test, vi } from "vitest";
import { ApprovalEscalator } from "#src/authority/approval-escalator";
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
