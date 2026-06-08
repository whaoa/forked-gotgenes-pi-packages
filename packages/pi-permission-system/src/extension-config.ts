import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeOptionalPositiveInt,
  normalizeOptionalStringArray,
  toRecord,
} from "./common";

export const EXTENSION_ID = "pi-permission-system";

export interface PermissionSystemExtensionConfig {
  debugLog: boolean;
  permissionReviewLog: boolean;
  yoloMode: boolean;
  /** Additional directories to auto-allow for reads as Pi infrastructure. */
  piInfrastructureReadPaths?: string[];
  /** Max length of the inline-JSON input preview shown in permission prompts. Defaults to 200. */
  toolInputPreviewMaxLength?: number;
  /** Max length of inline pattern/path summaries (grep/find/ls) in permission prompts. Defaults to 80. */
  toolTextSummaryMaxLength?: number;
}

export const DEFAULT_EXTENSION_CONFIG: PermissionSystemExtensionConfig = {
  debugLog: false,
  permissionReviewLog: true,
  yoloMode: false,
};

function resolveExtensionRoot(moduleUrl = import.meta.url): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}

export const EXTENSION_ROOT = resolveExtensionRoot();

const PERMISSION_POLICY_KEYS: ReadonlySet<string> = new Set([
  "defaultPolicy",
  "tools",
  "bash",
  "mcp",
  "skills",
  "special",
  "external_directory",
]);

export function detectMisplacedPermissionKeys(
  raw: Record<string, unknown>,
): string[] {
  return Object.keys(raw).filter((key) => PERMISSION_POLICY_KEYS.has(key));
}

export function normalizePermissionSystemConfig(
  raw: unknown,
): PermissionSystemExtensionConfig {
  const record = toRecord(raw);
  const piInfrastructureReadPaths = normalizeOptionalStringArray(
    record.piInfrastructureReadPaths,
  );
  const result: PermissionSystemExtensionConfig = {
    debugLog: record.debugLog === true,
    permissionReviewLog: record.permissionReviewLog !== false,
    yoloMode: record.yoloMode === true,
  };
  if (piInfrastructureReadPaths !== undefined) {
    result.piInfrastructureReadPaths = piInfrastructureReadPaths;
  }
  const toolInputPreviewMaxLength = normalizeOptionalPositiveInt(
    record.toolInputPreviewMaxLength,
  );
  if (toolInputPreviewMaxLength !== undefined) {
    result.toolInputPreviewMaxLength = toolInputPreviewMaxLength;
  }
  const toolTextSummaryMaxLength = normalizeOptionalPositiveInt(
    record.toolTextSummaryMaxLength,
  );
  if (toolTextSummaryMaxLength !== undefined) {
    result.toolTextSummaryMaxLength = toolTextSummaryMaxLength;
  }
  return result;
}

export function ensurePermissionSystemLogsDirectory(
  logsDir: string,
): string | undefined {
  try {
    mkdirSync(logsDir, { recursive: true });
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Failed to create permission-system log directory '${logsDir}': ${message}`;
  }
}
