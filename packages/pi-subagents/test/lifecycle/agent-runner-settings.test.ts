/**
 * agent-runner-settings.test.ts
 *
 * Tests for normalizeMaxTurns — the pure function that remains in agent-runner.ts
 * after the module-scope mutable state (defaultMaxTurns, graceTurns) was removed
 * in favour of SubagentRuntime fields threaded via RunOptions (issue #69).
 *
 * The setter/getter behaviour (clamping, unlimited-marker) is now exercised by:
 *   - test/runtime.test.ts — instance isolation and defaults
 *   - test/agent-runner.test.ts — RunOptions.defaultMaxTurns / graceTurns integration
 */
import { describe, expect, it } from "vitest";
import { normalizeMaxTurns } from "#src/lifecycle/agent-runner";

describe("normalizeMaxTurns", () => {
  it("treats undefined as unlimited", () => {
    expect(normalizeMaxTurns(undefined)).toBeUndefined();
  });

  it("treats 0 as unlimited", () => {
    expect(normalizeMaxTurns(0)).toBeUndefined();
  });

  it("keeps positive values", () => {
    expect(normalizeMaxTurns(7)).toBe(7);
  });

  it("clamps negative values to 1", () => {
    expect(normalizeMaxTurns(-3)).toBe(1);
  });

  it("accepts boundary value 1", () => {
    expect(normalizeMaxTurns(1)).toBe(1);
  });

  it("handles large values unchanged", () => {
    expect(normalizeMaxTurns(10_000)).toBe(10_000);
  });
});
