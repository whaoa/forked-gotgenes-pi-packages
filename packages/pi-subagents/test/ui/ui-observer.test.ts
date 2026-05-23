import { describe, expect, it } from "vitest";
import { AgentActivityTracker } from "../../src/ui/agent-activity-tracker.js";
import { subscribeUIObserver } from "../../src/ui/ui-observer.js";
import { createMockSession } from "../helpers/mock-session.js";

describe("subscribeUIObserver", () => {
	it("adds to activeTools on tool_execution_start and calls onUpdate", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		const onUpdate = () => {};
		subscribeUIObserver(session, tracker, onUpdate);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		expect(tracker.activeTools.size).toBe(1);
		expect([...tracker.activeTools.values()]).toContain("Read");
	});

	it("removes from activeTools on tool_execution_end", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		subscribeUIObserver(session, tracker);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		session.emit({ type: "tool_execution_end", toolName: "Read" });

		expect(tracker.activeTools.size).toBe(0);
	});

	it("resets responseText on message_start", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		subscribeUIObserver(session, tracker);

		session.emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "previous text" } });
		session.emit({ type: "message_start" });
		expect(tracker.responseText).toBe("");
	});

	it("appends to responseText on message_update text_delta and calls onUpdate", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		let updateCount = 0;
		subscribeUIObserver(session, tracker, () => updateCount++);

		session.emit({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "Hello " },
		});
		expect(tracker.responseText).toBe("Hello ");
		expect(updateCount).toBe(1);

		session.emit({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "world" },
		});
		expect(tracker.responseText).toBe("Hello world");
		expect(updateCount).toBe(2);
	});

	it("ignores message_update with non-text_delta events", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		let updateCount = 0;
		subscribeUIObserver(session, tracker, () => updateCount++);

		session.emit({
			type: "message_update",
			assistantMessageEvent: { type: "tool_use", name: "Read" },
		});
		expect(tracker.responseText).toBe("");
		expect(updateCount).toBe(0);
	});

	it("increments turnCount on turn_end and calls onUpdate", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		let updateCount = 0;
		subscribeUIObserver(session, tracker, () => updateCount++);

		expect(tracker.turnCount).toBe(1);
		session.emit({ type: "turn_end" });
		expect(tracker.turnCount).toBe(2);
		expect(updateCount).toBe(1);
	});

	it("returned function unsubscribes from session", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
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
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		subscribeUIObserver(session, tracker);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		session.emit({ type: "tool_execution_end", toolName: "Read" });
		session.emit({ type: "turn_end" });

		expect(tracker.activeTools.size).toBe(0);
		expect(tracker.turnCount).toBe(2);
	});

	it("calls onUpdate on tool_execution_start", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		let updateCount = 0;
		subscribeUIObserver(session, tracker, () => updateCount++);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		expect(updateCount).toBe(1);
	});

	it("calls onUpdate on tool_execution_end", () => {
		const session = createMockSession();
		const tracker = new AgentActivityTracker();
		let updateCount = 0;
		subscribeUIObserver(session, tracker, () => updateCount++);

		session.emit({ type: "tool_execution_start", toolName: "Read" });
		updateCount = 0; // reset after start
		session.emit({ type: "tool_execution_end", toolName: "Read" });
		expect(updateCount).toBe(1);
	});
});
