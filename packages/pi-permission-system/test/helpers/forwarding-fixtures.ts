/**
 * Shared fixtures for the forwarded-permission test files.
 *
 * Collapses the temp forwarding-directory scaffolding, the forwarded-request
 * writer, and the `PermissionForwarderDeps` / `ForwarderContext` / UI-decision
 * builders that `test/permission-forwarder.test.ts` repeated per test.
 *
 * Consumed by permission-forwarder.test.ts (and, forward-looking, by the
 * per-class tests Phase 8 Step 6 (#530) splits out of `PermissionForwarder`).
 * The `{ emit, on }` events mock is not duplicated here — reuse `makeEvents`
 * from `#test/helpers/handler-fixtures`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

import { DEFAULT_EXTENSION_CONFIG } from "#src/extension-config";
import type {
  ForwarderContext,
  PermissionForwarderDeps,
} from "#src/forwarded-permissions/permission-forwarder";
import type { PermissionPromptDecision } from "#src/permission-dialog";
import {
  createPermissionForwardingLocation,
  type ForwardedPermissionRequest,
  type PermissionForwardingLocation,
} from "#src/permission-forwarding";

/** Handle over a temp forwarding directory; register `cleanup` in `afterEach`. */
export interface ForwardingTempDir {
  /** Absolute path passed as `forwardingDir` to `PermissionForwarderDeps`. */
  forwardingDir: string;
  /** The session's request/response location under `forwardingDir`. */
  location: PermissionForwardingLocation;
  /** Writes a `ForwardedPermissionRequest` JSON into `location.requestsDir`. */
  writeRequest(
    overrides?: Partial<ForwardedPermissionRequest>,
  ): ForwardedPermissionRequest;
  /** `rmSync(root, { recursive, force })`. */
  cleanup(): void;
}

/**
 * Creates a temp forwarding directory for `sessionId`.
 *
 * Always creates `requests/`; pass `{ createResponsesDir: false }` to omit
 * `responses/` (the missing-`responses/` race test relies on this).
 */
export function createForwardingTempDir(
  sessionId: string,
  options: { createResponsesDir?: boolean } = {},
): ForwardingTempDir {
  const root = mkdtempSync(join(tmpdir(), "permission-forwarding-"));
  const forwardingDir = join(root, "forwarding");
  const location = createPermissionForwardingLocation(forwardingDir, sessionId);
  mkdirSync(location.requestsDir, { recursive: true });
  if (options.createResponsesDir ?? true) {
    mkdirSync(location.responsesDir, { recursive: true });
  }

  return {
    forwardingDir,
    location,
    writeRequest(overrides = {}) {
      const request: ForwardedPermissionRequest = {
        id: "req-forwarded",
        createdAt: Date.now(),
        requesterSessionId: "child-session",
        targetSessionId: sessionId,
        requesterAgentName: "Explore",
        message: "Allow git push?",
        ...overrides,
      };
      writeFileSync(
        join(location.requestsDir, `${request.id}.json`),
        JSON.stringify(request),
        "utf-8",
      );
      return request;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Builds `PermissionForwarderDeps` with linux defaults and an approving UI. */
export function makeForwarderDeps(
  overrides: Partial<PermissionForwarderDeps> = {},
): PermissionForwarderDeps {
  return {
    forwardingDir: "/tmp/forwarding",
    subagentSessionsDir: "/tmp/subagents",
    platform: "linux",
    logger: { review: vi.fn(), debug: vi.fn() },
    requestPermissionDecisionFromUi: vi
      .fn()
      .mockResolvedValue(makeUiDecision()),
    config: { current: () => ({ ...DEFAULT_EXTENSION_CONFIG }) },
    ...overrides,
  };
}

/**
 * Builds a `ForwarderContext`.
 *
 * The `sessionId` shortcut populates `getSessionId`; an explicit
 * `sessionManager` override merges last for tests stubbing other readers.
 */
export function makeForwarderContext(
  overrides: {
    hasUI?: boolean;
    ui?: ForwarderContext["ui"];
    sessionId?: string;
    sessionManager?: Partial<ForwarderContext["sessionManager"]>;
  } = {},
): ForwarderContext {
  return {
    hasUI: overrides.hasUI ?? false,
    ui: overrides.ui ?? { select: vi.fn(), input: vi.fn() },
    sessionManager: {
      getSessionId: vi.fn(() => overrides.sessionId ?? ""),
      getSessionDir: vi.fn(() => ""),
      getEntries: vi.fn(() => []),
      ...overrides.sessionManager,
    },
  };
}

/** Builds the UI decision `requestPermissionDecisionFromUi` resolves. */
export function makeUiDecision(
  overrides: Partial<PermissionPromptDecision> = {},
): PermissionPromptDecision {
  return { approved: true, state: "approved", ...overrides };
}
