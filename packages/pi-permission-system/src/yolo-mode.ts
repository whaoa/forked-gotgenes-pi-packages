import type { PermissionSystemExtensionConfig } from "./extension-config";
import type { PermissionState } from "./types";

export function isYoloModeEnabled(
  config: PermissionSystemExtensionConfig,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- typed as boolean but may be undefined at runtime (untyped callers); Boolean() guards against that
  return Boolean(config.yoloMode);
}

export function shouldAutoApprovePermissionState(
  state: PermissionState,
  config: PermissionSystemExtensionConfig,
): boolean {
  return state === "ask" && isYoloModeEnabled(config);
}
