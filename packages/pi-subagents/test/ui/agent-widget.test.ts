import { describe, expect, it } from "vitest";
import { assembleWidgetState } from "#src/ui/agent-widget";

// Minimal agent fixture — only the three fields AgentSummary requires.
function makeAgent(overrides: { id?: string; status?: string; completedAt?: number } = {}) {
	return {
		id: "agent-1",
		status: "completed",
		completedAt: 5000,
		...overrides,
	};
}

// shouldShowFinished stub that always returns true (default) or a fixed value.
const alwaysShow = () => true;
const neverShow = () => false;

describe("assembleWidgetState", () => {
	describe("empty list", () => {
		it("returns all-zero/false state for an empty agent list", () => {
			expect(assembleWidgetState([], alwaysShow)).toEqual({
				runningCount: 0,
				queuedCount: 0,
				hasFinished: false,
				hasActive: false,
			});
		});
	});

	describe("running agents", () => {
		it("counts a single running agent", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "running", completedAt: undefined })],
				alwaysShow,
			);
			expect(state.runningCount).toBe(1);
			expect(state.queuedCount).toBe(0);
			expect(state.hasFinished).toBe(false);
			expect(state.hasActive).toBe(true);
		});

		it("counts multiple running agents", () => {
			const agents = [
				makeAgent({ id: "a1", status: "running", completedAt: undefined }),
				makeAgent({ id: "a2", status: "running", completedAt: undefined }),
				makeAgent({ id: "a3", status: "running", completedAt: undefined }),
			];
			expect(assembleWidgetState(agents, alwaysShow).runningCount).toBe(3);
		});
	});

	describe("queued agents", () => {
		it("counts a single queued agent", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "queued", completedAt: undefined })],
				alwaysShow,
			);
			expect(state.runningCount).toBe(0);
			expect(state.queuedCount).toBe(1);
			expect(state.hasFinished).toBe(false);
			expect(state.hasActive).toBe(true);
		});

		it("counts multiple queued agents", () => {
			const agents = [
				makeAgent({ id: "a1", status: "queued", completedAt: undefined }),
				makeAgent({ id: "a2", status: "queued", completedAt: undefined }),
			];
			expect(assembleWidgetState(agents, alwaysShow).queuedCount).toBe(2);
		});
	});

	describe("finished agents", () => {
		it("sets hasFinished when a completed agent has completedAt and shouldShowFinished returns true", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "completed", completedAt: 5000 })],
				alwaysShow,
			);
			expect(state.hasFinished).toBe(true);
			expect(state.hasActive).toBe(false);
		});

		it("does not set hasFinished when shouldShowFinished returns false", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "completed", completedAt: 5000 })],
				neverShow,
			);
			expect(state.hasFinished).toBe(false);
		});

		it("does not set hasFinished when completedAt is absent", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "error", completedAt: undefined })],
				alwaysShow,
			);
			expect(state.hasFinished).toBe(false);
		});

		it("passes agentId and status to shouldShowFinished", () => {
			const calls: Array<{ id: string; status: string }> = [];
			assembleWidgetState(
				[makeAgent({ id: "agent-42", status: "error", completedAt: 9000 })],
				(id, status) => { calls.push({ id, status }); return true; },
			);
			expect(calls).toEqual([{ id: "agent-42", status: "error" }]);
		});

		it("sets hasFinished for error status agents when shouldShowFinished returns true", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "error", completedAt: 5000 })],
				alwaysShow,
			);
			expect(state.hasFinished).toBe(true);
		});
	});

	describe("mixed states", () => {
		it("counts running and queued independently", () => {
			const agents = [
				makeAgent({ id: "a1", status: "running", completedAt: undefined }),
				makeAgent({ id: "a2", status: "running", completedAt: undefined }),
				makeAgent({ id: "a3", status: "queued", completedAt: undefined }),
			];
			const state = assembleWidgetState(agents, alwaysShow);
			expect(state.runningCount).toBe(2);
			expect(state.queuedCount).toBe(1);
			expect(state.hasActive).toBe(true);
			expect(state.hasFinished).toBe(false);
		});

		it("reports both hasActive and hasFinished when present", () => {
			const agents = [
				makeAgent({ id: "a1", status: "running", completedAt: undefined }),
				makeAgent({ id: "a2", status: "completed", completedAt: 5000 }),
			];
			const state = assembleWidgetState(agents, alwaysShow);
			expect(state.hasActive).toBe(true);
			expect(state.hasFinished).toBe(true);
			expect(state.runningCount).toBe(1);
		});

		it("running agents are not counted as finished even if completedAt is set", () => {
			// Unusual but defensive: a running agent with a completedAt should
			// be counted as running, not finished.
			const state = assembleWidgetState(
				[makeAgent({ status: "running", completedAt: 5000 })],
				alwaysShow,
			);
			expect(state.runningCount).toBe(1);
			expect(state.hasFinished).toBe(false);
		});
	});

	describe("hasActive derivation", () => {
		it("is false when only finished agents exist", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "completed", completedAt: 5000 })],
				alwaysShow,
			);
			expect(state.hasActive).toBe(false);
		});

		it("is true with any running agent", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "running", completedAt: undefined })],
				neverShow,
			);
			expect(state.hasActive).toBe(true);
		});

		it("is true with any queued agent", () => {
			const state = assembleWidgetState(
				[makeAgent({ status: "queued", completedAt: undefined })],
				neverShow,
			);
			expect(state.hasActive).toBe(true);
		});
	});
});
