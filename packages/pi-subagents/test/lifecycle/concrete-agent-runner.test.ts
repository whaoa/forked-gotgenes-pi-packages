import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { ConcreteAgentRunner } from "#src/lifecycle/agent-runner";
import { createRunnerDeps } from "#test/helpers/runner-io";
import { STUB_SNAPSHOT } from "#test/helpers/stub-ctx";

// ── Minimal session stub ──────────────────────────────────────────────────────

function makeSession(text: string) {
	const listeners: Array<(event: unknown) => void> = [];
	const session = {
		messages: [{ role: "assistant", content: [{ type: "text", text }] }] as unknown[],
		subscribe: vi.fn((fn: (event: unknown) => void) => {
			listeners.push(fn);
			return () => {};
		}),
		getActiveToolNames: vi.fn().mockReturnValue([]),
		setActiveToolsByName: vi.fn(),
		bindExtensions: vi.fn().mockResolvedValue(undefined),
		prompt: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn(),
		steer: vi.fn(),
	};
	return { session: session as unknown as AgentSession };
}

describe("ConcreteAgentRunner", () => {
	it("delegates run() to runAgent and returns a RunResult", async () => {
		const deps = createRunnerDeps();
		const { session } = makeSession("result text");
		deps.io.createSession.mockResolvedValue({ session });

		const runner = new ConcreteAgentRunner(deps);
		const result = await runner.run(STUB_SNAPSHOT, "Explore", "do the thing", {
			context: {},
		});

		expect(result.responseText).toBe("result text");
		expect(result.session).toBe(session);
		expect(deps.io.detectEnv).toHaveBeenCalled();
	});

	it("delegates resume() to resumeAgent and returns response text", async () => {
		const listeners: Array<(event: unknown) => void> = [];
		const session = {
			messages: [{ role: "assistant", content: [{ type: "text", text: "resumed" }] }] as unknown[],
			subscribe: vi.fn((fn: (event: unknown) => void) => {
				listeners.push(fn);
				return () => {};
			}),
			prompt: vi.fn().mockResolvedValue(undefined),
		} as unknown as AgentSession;

		const runner = new ConcreteAgentRunner(createRunnerDeps());
		const text = await runner.resume(session, "continue");

		expect(text).toBe("resumed");
		expect((session.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("continue");
	});
});
