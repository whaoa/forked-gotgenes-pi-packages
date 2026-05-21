import { describe, expect, it } from "vitest";
import { createTestRecord } from "./make-record.js";

describe("createTestRecord", () => {
	it("returns a completed record with expected defaults", () => {
		const record = createTestRecord();
		expect(record.id).toBe("agent-1");
		expect(record.type).toBe("general-purpose");
		expect(record.description).toBe("Test task");
		expect(record.status).toBe("completed");
		expect(record.result).toBe("All done.");
		expect(record.toolUses).toBe(3);
		expect(record.startedAt).toBe(1000);
		expect(record.completedAt).toBe(2000);
		expect(record.compactionCount).toBe(0);
		expect(record.lifetimeUsage).toEqual({ input: 500, output: 500, cacheWrite: 0 });
	});

	it("applies overrides to defaults", () => {
		const record = createTestRecord({ id: "custom-id", status: "running" });
		expect(record.id).toBe("custom-id");
		expect(record.status).toBe("running");
		// Non-overridden fields retain defaults
		expect(record.description).toBe("Test task");
		expect(record.toolUses).toBe(3);
	});

	it("allows setting promise (optional field not in defaults)", () => {
		const promise = Promise.resolve("done");
		const record = createTestRecord({ promise });
		expect(record.promise).toBe(promise);
	});

	it("allows overriding defaults to undefined", () => {
		const record = createTestRecord({ result: undefined, completedAt: undefined });
		expect(record.result).toBeUndefined();
		expect(record.completedAt).toBeUndefined();
	});
});
