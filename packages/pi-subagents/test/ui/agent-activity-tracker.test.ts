import { describe, expect, it } from "vitest";
import { AgentActivityTracker } from "../../src/ui/agent-activity-tracker.js";

describe("AgentActivityTracker", () => {
	describe("constructor", () => {
		it("sets initial turnCount to 1", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.turnCount).toBe(1);
		});

		it("sets initial toolUses to 0", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.toolUses).toBe(0);
		});

		it("sets initial responseText to empty string", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.responseText).toBe("");
		});

		it("sets initial activeTools to empty map", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.activeTools.size).toBe(0);
		});

		it("sets initial lifetimeUsage to zeroes", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.lifetimeUsage).toEqual({ input: 0, output: 0, cacheWrite: 0 });
		});

		it("sets session to undefined initially", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.session).toBeUndefined();
		});

		it("sets maxTurns from constructor argument", () => {
			const tracker = new AgentActivityTracker(30);
			expect(tracker.maxTurns).toBe(30);
		});

		it("sets maxTurns to undefined when not provided", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.maxTurns).toBeUndefined();
		});
	});

	describe("onToolStart", () => {
		it("adds an entry to activeTools", () => {
			const tracker = new AgentActivityTracker();
			tracker.onToolStart("Read");
			expect(tracker.activeTools.size).toBe(1);
			expect([...tracker.activeTools.values()]).toContain("Read");
		});

		it("tracks multiple different tools", () => {
			const tracker = new AgentActivityTracker();
			tracker.onToolStart("Read");
			tracker.onToolStart("Bash");
			expect(tracker.activeTools.size).toBe(2);
			expect([...tracker.activeTools.values()]).toContain("Read");
			expect([...tracker.activeTools.values()]).toContain("Bash");
		});

		it("tracks multiple concurrent tools with the same name independently", () => {
			const tracker = new AgentActivityTracker();
			tracker.onToolStart("Read");
			tracker.onToolStart("Read");
			expect(tracker.activeTools.size).toBe(2);
			expect([...tracker.activeTools.values()]).toEqual(["Read", "Read"]);
		});
	});

	describe("onToolEnd", () => {
		it("removes one entry from activeTools and increments toolUses", () => {
			const tracker = new AgentActivityTracker();
			tracker.onToolStart("Read");
			tracker.onToolEnd("Read");
			expect(tracker.activeTools.size).toBe(0);
			expect(tracker.toolUses).toBe(1);
		});

		it("removes only one entry when multiple same-name tools are active", () => {
			const tracker = new AgentActivityTracker();
			tracker.onToolStart("Read");
			tracker.onToolStart("Read");
			tracker.onToolEnd("Read");
			expect(tracker.activeTools.size).toBe(1);
			expect(tracker.toolUses).toBe(1);
		});

		it("is a no-op when no matching tool is active", () => {
			const tracker = new AgentActivityTracker();
			tracker.onToolEnd("Read");
			expect(tracker.activeTools.size).toBe(0);
			expect(tracker.toolUses).toBe(0);
		});
	});

	describe("onMessageStart", () => {
		it("resets responseText to empty string", () => {
			const tracker = new AgentActivityTracker();
			tracker.onMessageUpdate("hello");
			tracker.onMessageStart();
			expect(tracker.responseText).toBe("");
		});
	});

	describe("onMessageUpdate", () => {
		it("appends delta to responseText", () => {
			const tracker = new AgentActivityTracker();
			tracker.onMessageUpdate("Hello ");
			expect(tracker.responseText).toBe("Hello ");
			tracker.onMessageUpdate("world");
			expect(tracker.responseText).toBe("Hello world");
		});
	});

	describe("onTurnEnd", () => {
		it("increments turnCount", () => {
			const tracker = new AgentActivityTracker();
			expect(tracker.turnCount).toBe(1);
			tracker.onTurnEnd();
			expect(tracker.turnCount).toBe(2);
			tracker.onTurnEnd();
			expect(tracker.turnCount).toBe(3);
		});
	});

	describe("onUsageUpdate", () => {
		it("accumulates usage into lifetimeUsage", () => {
			const tracker = new AgentActivityTracker();
			tracker.onUsageUpdate({ input: 100, output: 50, cacheWrite: 10 });
			expect(tracker.lifetimeUsage).toEqual({ input: 100, output: 50, cacheWrite: 10 });
		});

		it("accumulates across multiple calls", () => {
			const tracker = new AgentActivityTracker();
			tracker.onUsageUpdate({ input: 100, output: 50, cacheWrite: 10 });
			tracker.onUsageUpdate({ input: 200, output: 80, cacheWrite: 20 });
			expect(tracker.lifetimeUsage).toEqual({ input: 300, output: 130, cacheWrite: 30 });
		});
	});

	describe("setSession", () => {
		it("stores the session reference", () => {
			const tracker = new AgentActivityTracker();
			const session = { getSessionStats: () => ({ tokens: { input: 0, output: 0, cacheWrite: 0 } }) };
			tracker.setSession(session);
			expect(tracker.session).toBe(session);
		});
	});

	describe("read-only surface", () => {
		it("activeTools returns a ReadonlyMap (TypeScript compile guard)", () => {
			const tracker = new AgentActivityTracker();
			const tools: ReadonlyMap<string, string> = tracker.activeTools;
			expect(tools).toBeDefined();
		});

		it("lifetimeUsage returns a Readonly object (TypeScript compile guard)", () => {
			const tracker = new AgentActivityTracker();
			const usage: Readonly<{ input: number; output: number; cacheWrite: number }> = tracker.lifetimeUsage;
			expect(usage).toBeDefined();
		});
	});
});
