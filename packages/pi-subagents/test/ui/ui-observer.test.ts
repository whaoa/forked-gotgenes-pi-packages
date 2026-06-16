import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentActivityTracker } from "#src/ui/agent-activity-tracker";
import { subscribeUIObserver } from "#src/ui/ui-observer";
import { createMockSession } from "#test/helpers/mock-session";

describe("subscribeUIObserver", () => {
	let session: ReturnType<typeof createMockSession>;
	let tracker: AgentActivityTracker;

	beforeEach(() => {
		session = createMockSession();
		tracker = new AgentActivityTracker();
	});

	it("adds to activeTools on tool_execution_start and calls onUpdate", () => {
		subscribeUIObserver(session, tracker, () => {});

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		expect(tracker.activeTools.size).toBe(1);
		expect([...tracker.activeTools.values()]).toContain("Read");
	});

	it("removes from activeTools on tool_execution_end", () => {
		subscribeUIObserver(session, tracker);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		session.emit({ type: "tool_execution_end", toolName: "Read" });

		expect(tracker.activeTools.size).toBe(0);
	});

	it("resets responseText on message_start", () => {
		subscribeUIObserver(session, tracker);

		session.emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "previous text" } });
		session.emit({ type: "message_start" });
		expect(tracker.responseText).toBe("");
	});

	it("appends to responseText on message_update text_delta and calls onUpdate", () => {
		const onUpdate = vi.fn();
		subscribeUIObserver(session, tracker, onUpdate);

		session.emit({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "Hello " },
		});
		expect(tracker.responseText).toBe("Hello ");
		expect(onUpdate).toHaveBeenCalledTimes(1);

		session.emit({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "world" },
		});
		expect(tracker.responseText).toBe("Hello world");
		expect(onUpdate).toHaveBeenCalledTimes(2);
	});

	it("ignores message_update with non-text_delta events", () => {
		const onUpdate = vi.fn();
		subscribeUIObserver(session, tracker, onUpdate);

		session.emit({
			type: "message_update",
			assistantMessageEvent: { type: "tool_use", name: "Read" },
		});
		expect(tracker.responseText).toBe("");
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("increments turnCount on turn_end and calls onUpdate", () => {
		const onUpdate = vi.fn();
		subscribeUIObserver(session, tracker, onUpdate);

		expect(tracker.turnCount).toBe(1);
		session.emit({ type: "turn_end" });
		expect(tracker.turnCount).toBe(2);
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it("returned function unsubscribes from session", () => {
		const unsubscribe = subscribeUIObserver(session, tracker);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		session.emit({ type: "tool_execution_end", toolName: "Read" });
		expect(tracker.activeTools.size).toBe(0); // tool was removed

		unsubscribe();

		session.emit({ type: "tool_execution_start", toolName: "Write" });
		session.emit({ type: "tool_execution_end", toolName: "Write" });
		// After unsubscribe, the Write tool start was not observed
		expect(tracker.activeTools.size).toBe(0);
	});

	it("works without onUpdate callback", () => {
		subscribeUIObserver(session, tracker);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		session.emit({ type: "tool_execution_end", toolName: "Read" });
		session.emit({ type: "turn_end" });

		expect(tracker.activeTools.size).toBe(0);
		expect(tracker.turnCount).toBe(2);
	});

	it("calls onUpdate on tool_execution_start", () => {
		const onUpdate = vi.fn();
		subscribeUIObserver(session, tracker, onUpdate);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it("calls onUpdate on tool_execution_end", () => {
		const onUpdate = vi.fn();
		subscribeUIObserver(session, tracker, onUpdate);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		onUpdate.mockClear(); // reset after start
		session.emit({ type: "tool_execution_end", toolName: "Read" });
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});
});
