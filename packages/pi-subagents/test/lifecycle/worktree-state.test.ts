import { describe, expect, it } from "vitest";
import { WorktreeState } from "#src/lifecycle/worktree-state";

describe("WorktreeState — constructor", () => {
	it("stores path and branch from WorktreeInfo", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		expect(state.path).toBe("/tmp/agent-1");
		expect(state.branch).toBe("pi-agent-1");
	});

	it("cleanupResult is undefined before recordCleanup", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		expect(state.cleanupResult).toBeUndefined();
	});
});

describe("WorktreeState — recordCleanup", () => {
	it("stores the cleanup result", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		state.recordCleanup({ hasChanges: true, branch: "pi-agent-1" });
		expect(state.cleanupResult).toEqual({ hasChanges: true, branch: "pi-agent-1" });
	});

	it("stores no-changes cleanup result", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		state.recordCleanup({ hasChanges: false });
		expect(state.cleanupResult).toEqual({ hasChanges: false });
	});

	it("path and branch remain unchanged after recordCleanup", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		state.recordCleanup({ hasChanges: true, branch: "pi-agent-1" });
		expect(state.path).toBe("/tmp/agent-1");
		expect(state.branch).toBe("pi-agent-1");
	});
});
