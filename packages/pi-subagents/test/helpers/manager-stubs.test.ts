import { describe, expect, it, vi } from "vitest";
import { createBlockingRunner, createMockWorktrees, createRunResult, createSessionRunner } from "./manager-stubs";
import { createMockSession } from "./mock-session";

describe("createBlockingRunner", () => {
	it("run returns a pending promise (never resolves)", () => {
		const runner = createBlockingRunner();
		const p = runner.run({} as never, "general-purpose", "test", {} as never);
		// The promise must still be pending — we check it doesn't settle synchronously
		let settled = false;
		void p.then(() => {
			settled = true;
		});
		expect(settled).toBe(false);
	});

	it("exposes run and resume as vi.fn stubs", () => {
		const runner = createBlockingRunner();
		expect(vi.isMockFunction(runner.run)).toBe(true);
		expect(vi.isMockFunction(runner.resume)).toBe(true);
	});
});

describe("createRunResult", () => {
	it("returns the expected default shape", () => {
		const result = createRunResult();
		expect(result.responseText).toBe("done");
		expect(result.aborted).toBe(false);
		expect(result.steered).toBe(false);
		expect(result.session).toBeDefined();
	});

	it("uses the provided session", () => {
		const session = createMockSession();
		const result = createRunResult(session);
		// The session is cast to AgentSession — verify it is the same object via identity.
		expect(result.session).toBe(session);
	});
});

describe("createSessionRunner", () => {
	it("calls onSessionCreated with the given session", async () => {
		const session = createMockSession();
		const runner = createSessionRunner(session);
		const onSessionCreated = vi.fn();

		await runner.run({} as never, "general-purpose", "test", {
			context: {},
			onSessionCreated,
		});

		expect(onSessionCreated).toHaveBeenCalledOnce();
		expect(onSessionCreated).toHaveBeenCalledWith(session);
	});

	it("resolves with a RunResult containing the given session", async () => {
		const session = createMockSession();
		const runner = createSessionRunner(session);

		const result = await runner.run({} as never, "general-purpose", "test", {
			context: {},
		});

		expect(result.responseText).toBe("done");
		expect(result.session).toBe(session);
	});

	it("exposes run and resume as vi.fn stubs", () => {
		const runner = createSessionRunner(createMockSession());
		expect(vi.isMockFunction(runner.run)).toBe(true);
		expect(vi.isMockFunction(runner.resume)).toBe(true);
	});
});

describe("createMockWorktrees", () => {
	it("returns default path and branch when no overrides given", () => {
		const wt = createMockWorktrees();
		expect(wt.create("id-1")).toEqual({ path: "/tmp/wt", branch: "pi-agent-x" });
	});

	it("returns undefined from create when createResult: undefined is passed", () => {
		const wt = createMockWorktrees({ createResult: undefined });
		expect(wt.create("id-1")).toBeUndefined();
	});

	it("returns custom WorktreeInfo when createResult is provided", () => {
		const wt = createMockWorktrees({ createResult: { path: "/custom/wt", branch: "custom-branch" } });
		expect(wt.create("id-1")).toEqual({ path: "/custom/wt", branch: "custom-branch" });
	});

	it("cleanup returns { hasChanges: false } by default", () => {
		const wt = createMockWorktrees();
		expect(wt.cleanup({ path: "/tmp/wt", branch: "pi-agent-x" }, "desc")).toEqual({ hasChanges: false });
	});

	it("cleanup returns custom result when cleanupResult is provided", () => {
		const wt = createMockWorktrees({ cleanupResult: { hasChanges: true, branch: "pi-agent-x" } });
		expect(wt.cleanup({ path: "/tmp/wt", branch: "pi-agent-x" }, "desc")).toEqual({
			hasChanges: true,
			branch: "pi-agent-x",
		});
	});

	it("exposes create, cleanup, prune as vi.fn stubs", () => {
		const wt = createMockWorktrees();
		expect(vi.isMockFunction(wt.create)).toBe(true);
		expect(vi.isMockFunction(wt.cleanup)).toBe(true);
		expect(vi.isMockFunction(wt.prune)).toBe(true);
	});
});
