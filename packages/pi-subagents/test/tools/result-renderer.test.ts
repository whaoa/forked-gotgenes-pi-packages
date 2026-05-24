import { describe, expect, it } from "vitest";
import { renderStats } from "#src/tools/result-renderer";
import type { AgentDetails, Theme } from "#src/ui/display";

function makeTheme(): Theme {
	return {
		fg: (color: string, text: string) => `[${color}:${text}]`,
		bold: (text: string) => `**${text}**`,
	};
}

function makeDetails(overrides: Partial<AgentDetails> = {}): AgentDetails {
	return {
		displayName: "TestAgent",
		description: "test task",
		subagentType: "general-purpose",
		toolUses: 0,
		tokens: "",
		durationMs: 2000,
		status: "completed",
		...overrides,
	};
}

describe("renderStats", () => {
	const theme = makeTheme();

	it("returns empty string when all fields are absent or zero", () => {
		const details = makeDetails({ toolUses: 0, tokens: "" });
		expect(renderStats(details, theme)).toBe("");
	});

	it("includes model name", () => {
		const details = makeDetails({ modelName: "haiku" });
		expect(renderStats(details, theme)).toContain("[dim:haiku]");
	});

	it("includes tags", () => {
		const details = makeDetails({ tags: ["thinking: high", "isolated"] });
		const result = renderStats(details, theme);
		expect(result).toContain("[dim:thinking: high]");
		expect(result).toContain("[dim:isolated]");
	});

	it("includes turn count with max turns", () => {
		const details = makeDetails({ turnCount: 5, maxTurns: 30 });
		expect(renderStats(details, theme)).toContain("[dim:⟳5≤30]");
	});

	it("includes turn count without max turns", () => {
		const details = makeDetails({ turnCount: 5 });
		expect(renderStats(details, theme)).toContain("[dim:⟳5]");
	});

	it("excludes turn count when turnCount is 0", () => {
		const details = makeDetails({ turnCount: 0 });
		expect(renderStats(details, theme)).not.toContain("⟳");
	});

	it("excludes turn count when turnCount is undefined", () => {
		const details = makeDetails({ turnCount: undefined });
		expect(renderStats(details, theme)).not.toContain("⟳");
	});

	it("includes singular tool use", () => {
		const details = makeDetails({ toolUses: 1 });
		expect(renderStats(details, theme)).toContain("[dim:1 tool use]");
	});

	it("includes plural tool uses", () => {
		const details = makeDetails({ toolUses: 3 });
		expect(renderStats(details, theme)).toContain("[dim:3 tool uses]");
	});

	it("excludes tool uses when count is zero", () => {
		const details = makeDetails({ toolUses: 0 });
		expect(renderStats(details, theme)).not.toContain("tool use");
	});

	it("includes tokens", () => {
		const details = makeDetails({ tokens: "33.8k token" });
		expect(renderStats(details, theme)).toContain("[dim:33.8k token]");
	});

	it("joins multiple parts with dim separator", () => {
		const details = makeDetails({ modelName: "haiku", toolUses: 2 });
		expect(renderStats(details, theme)).toBe("[dim:haiku] [dim:·] [dim:2 tool uses]");
	});
});
