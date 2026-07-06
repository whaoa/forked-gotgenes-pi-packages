import { afterEach, describe, expect, test, vi } from "vitest";
import type { PermissionSystemExtensionConfig } from "#src/extension-config";
import { DEFAULT_EXTENSION_CONFIG } from "#src/extension-config";
import { shouldAutoApprovePermissionState } from "#src/yolo-mode";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeConfig(
  yoloMode: boolean | undefined,
): PermissionSystemExtensionConfig {
  return { yoloMode } as PermissionSystemExtensionConfig;
}

describe("shouldAutoApprovePermissionState", () => {
  test("returns true for 'ask' when yolo mode is on", () => {
    expect(shouldAutoApprovePermissionState("ask", makeConfig(true))).toBe(
      true,
    );
  });

  test("returns false for 'ask' when yolo mode is off", () => {
    expect(shouldAutoApprovePermissionState("ask", makeConfig(false))).toBe(
      false,
    );
  });

  test("returns false for 'ask' when yolo mode is undefined", () => {
    expect(shouldAutoApprovePermissionState("ask", makeConfig(undefined))).toBe(
      false,
    );
  });

  test("returns false for 'allow' even when yolo mode is on", () => {
    expect(shouldAutoApprovePermissionState("allow", makeConfig(true))).toBe(
      false,
    );
  });

  test("returns false for 'deny' even when yolo mode is on", () => {
    expect(shouldAutoApprovePermissionState("deny", makeConfig(true))).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Moved from permission-system.test.ts catch-all (#342)
// ---------------------------------------------------------------------------

test("Yolo mode only auto-approves ask-state permissions", () => {
  expect(
    shouldAutoApprovePermissionState("ask", DEFAULT_EXTENSION_CONFIG),
  ).toBe(false);
  expect(
    shouldAutoApprovePermissionState("ask", {
      ...DEFAULT_EXTENSION_CONFIG,
      yoloMode: true,
    }),
  ).toBe(true);
  expect(
    shouldAutoApprovePermissionState("deny", {
      ...DEFAULT_EXTENSION_CONFIG,
      yoloMode: true,
    }),
  ).toBe(false);
  expect(
    shouldAutoApprovePermissionState("allow", {
      ...DEFAULT_EXTENSION_CONFIG,
      yoloMode: true,
    }),
  ).toBe(false);
});
