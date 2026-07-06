import { describe, expect, test } from "vitest";

import {
  getNonEmptyString,
  isDenyWithReason,
  isPermissionState,
  toRecord,
} from "#src/value-guards";

describe("toRecord", () => {
  test("returns empty object for null", () => {
    expect(toRecord(null)).toEqual({});
  });

  test("returns empty object for undefined", () => {
    expect(toRecord(undefined)).toEqual({});
  });

  test("returns empty object for a string", () => {
    expect(toRecord("hello")).toEqual({});
  });

  test("returns empty object for a number", () => {
    expect(toRecord(42)).toEqual({});
  });

  test("returns empty object for an array", () => {
    expect(toRecord(["a", "b"])).toEqual({});
  });

  test("returns the object itself for a plain object", () => {
    const input = { a: 1, b: "two" };
    expect(toRecord(input)).toBe(input);
  });

  test("returns the object for a nested object", () => {
    const input = { x: { y: 3 } };
    expect(toRecord(input)).toBe(input);
  });
});

describe("getNonEmptyString", () => {
  test("returns null for non-string values", () => {
    expect(getNonEmptyString(null)).toBeNull();
    expect(getNonEmptyString(undefined)).toBeNull();
    expect(getNonEmptyString(42)).toBeNull();
    expect(getNonEmptyString({})).toBeNull();
    expect(getNonEmptyString([])).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(getNonEmptyString("")).toBeNull();
  });

  test("returns null for whitespace-only string", () => {
    expect(getNonEmptyString("   ")).toBeNull();
    expect(getNonEmptyString("\t\n")).toBeNull();
  });

  test("returns trimmed string for valid string", () => {
    expect(getNonEmptyString("hello")).toBe("hello");
    expect(getNonEmptyString("  hello  ")).toBe("hello");
  });

  test("returns single non-whitespace character", () => {
    expect(getNonEmptyString("a")).toBe("a");
  });
});

describe("isPermissionState", () => {
  test("returns true for 'allow'", () => {
    expect(isPermissionState("allow")).toBe(true);
  });

  test("returns true for 'deny'", () => {
    expect(isPermissionState("deny")).toBe(true);
  });

  test("returns true for 'ask'", () => {
    expect(isPermissionState("ask")).toBe(true);
  });

  test("returns false for unrecognized strings", () => {
    expect(isPermissionState("ALLOW")).toBe(false);
    expect(isPermissionState("permit")).toBe(false);
    expect(isPermissionState("")).toBe(false);
    expect(isPermissionState("block")).toBe(false);
  });

  test("returns false for non-string types", () => {
    expect(isPermissionState(null)).toBe(false);
    expect(isPermissionState(undefined)).toBe(false);
    expect(isPermissionState(1)).toBe(false);
    expect(isPermissionState({})).toBe(false);
  });
});

describe("isDenyWithReason", () => {
  test("returns true for { action: 'deny' } without a reason", () => {
    expect(isDenyWithReason({ action: "deny" })).toBe(true);
  });

  test("returns true for { action: 'deny', reason: '...' }", () => {
    expect(isDenyWithReason({ action: "deny", reason: "Use pnpm" })).toBe(true);
  });

  test("returns false for non-deny actions", () => {
    expect(isDenyWithReason({ action: "allow" })).toBe(false);
    expect(isDenyWithReason({ action: "ask" })).toBe(false);
  });

  test("returns false for a non-string reason", () => {
    expect(isDenyWithReason({ action: "deny", reason: 42 })).toBe(false);
    expect(isDenyWithReason({ action: "deny", reason: null })).toBe(false);
  });

  test("returns false for non-object types", () => {
    expect(isDenyWithReason(null)).toBe(false);
    expect(isDenyWithReason(undefined)).toBe(false);
    expect(isDenyWithReason("deny")).toBe(false);
    expect(isDenyWithReason(["deny"])).toBe(false);
  });
});
