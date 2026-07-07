import { join } from "node:path";
import {
  type ForwarderContext,
  getSessionId,
} from "#src/authority/forwarder-context";
import type { ConfigReader } from "#src/config-store";
import { isYoloModeEnabled } from "#src/extension-config";
import type {
  PermissionDecisionUi,
  PermissionPromptDecision,
  RequestPermissionOptions,
} from "#src/permission-dialog";
import {
  emitUiPromptEvent,
  type PermissionEventBus,
} from "#src/permission-events";
import {
  type ForwardedPermissionRequest,
  type ForwardedPermissionResponse,
  isForwardedPermissionRequestForSession,
  type PermissionForwardingLocation,
} from "#src/permission-forwarding";
import { buildForwardedUiPrompt } from "#src/permission-ui-prompt";
import type { DebugReviewLogger } from "#src/session-logger";

import {
  cleanupPermissionForwardingLocationIfEmpty,
  ensureDirectoryExists,
  getExistingPermissionForwardingLocation,
  listRequestFiles,
  logPermissionForwardingError,
  logPermissionForwardingWarning,
  readForwardedPermissionRequest,
  safeDeleteFile,
  writeJsonFileAtomic,
} from "./forwarding-io";

/**
 * Narrow seam describing what `ForwardingManager` needs from the server: a
 * single method that drains this session's forwarded-permission inbox.
 *
 * Depending on the interface (not the concrete `ForwardedRequestServer`)
 * keeps the manager's unit tests free of casts — they inject a plain
 * `{ processInbox: vi.fn() }` mock.
 */
export interface InboxProcessor {
  processInbox(ctx: ForwarderContext): Promise<void>;
}

/** Constructor config for `ForwardedRequestServer`. */
export interface ForwardedRequestServerDeps {
  forwardingDir: string;
  logger: DebugReviewLogger;
  /** Event bus used for UI prompt broadcasts. */
  events?: PermissionEventBus;
  requestPermissionDecisionFromUi: (
    ui: PermissionDecisionUi,
    title: string,
    message: string,
    options?: RequestPermissionOptions,
  ) => Promise<PermissionPromptDecision>;
  /** Read current config for the retained forwarded-inbox yolo auto-approve check. */
  config: ConfigReader;
}

// ── Module-private helpers ────────────────────────────────────────────────

function formatForwardedPermissionPrompt(
  request: ForwardedPermissionRequest,
): string {
  const agentName = request.requesterAgentName || "unknown";
  const sessionId = request.requesterSessionId || "unknown";
  return [
    `Subagent '${agentName}' requested permission.`,
    `Session ID: ${sessionId}`,
    "",
    request.message,
  ].join("\n");
}

// ── ForwardedRequestServer ────────────────────────────────────────────────

/**
 * Owner of the serving-down role of the forwarded-permission behavior:
 * draining this session's forwarded-permission inbox and answering each
 * request (auto-approve under yolo, or prompt via the injected UI).
 */
export class ForwardedRequestServer implements InboxProcessor {
  private readonly forwardingDir: string;
  private readonly events: PermissionEventBus | undefined;
  private readonly logger: DebugReviewLogger;
  private readonly requestPermissionDecisionFromUi: (
    ui: PermissionDecisionUi,
    title: string,
    message: string,
    options?: RequestPermissionOptions,
  ) => Promise<PermissionPromptDecision>;
  private readonly config: ConfigReader;

  constructor(deps: ForwardedRequestServerDeps) {
    this.forwardingDir = deps.forwardingDir;
    this.events = deps.events;
    this.logger = deps.logger;
    this.requestPermissionDecisionFromUi = deps.requestPermissionDecisionFromUi;
    this.config = deps.config;
  }

  /** Drain and respond to this session's forwarded-permission inbox. */
  async processInbox(ctx: ForwarderContext): Promise<void> {
    if (!ctx.hasUI) {
      return;
    }

    const currentSessionId = getSessionId(ctx);
    const location = getExistingPermissionForwardingLocation(
      this.forwardingDir,
      currentSessionId,
    );
    if (!location) {
      return;
    }

    const requestFiles = listRequestFiles(this.logger, location.requestsDir);
    if (requestFiles.length === 0) {
      return;
    }

    // Defensively recreate responses/ before writing any response — a
    // concurrent cleanup pass may have removed it between the requestsDir
    // existence check above and the write inside processSingleForwardedRequest
    // (the ENOENT write loop reported in issue #398).
    if (
      !ensureDirectoryExists(
        this.logger,
        location.responsesDir,
        "permission forwarding responses",
      )
    ) {
      return;
    }

    for (const fileName of requestFiles) {
      const requestPath = join(location.requestsDir, fileName);
      const request = readForwardedPermissionRequest(this.logger, requestPath);
      if (!request) {
        safeDeleteFile(
          this.logger,
          requestPath,
          `${location.label} forwarded permission request`,
        );
        continue;
      }

      await this.processSingleForwardedRequest(
        ctx,
        request,
        location,
        requestPath,
        currentSessionId,
      );
    }

    cleanupPermissionForwardingLocationIfEmpty(this.logger, location);
  }

  // ── Private methods ────────────────────────────────────────────────────

  private async processSingleForwardedRequest(
    ctx: ForwarderContext,
    request: ForwardedPermissionRequest,
    location: PermissionForwardingLocation,
    requestPath: string,
    currentSessionId: string,
  ): Promise<void> {
    if (!isForwardedPermissionRequestForSession(request, currentSessionId)) {
      logPermissionForwardingWarning(
        this.logger,
        `Ignoring forwarded permission request '${request.id}' because it targets session '${request.targetSessionId}' instead of '${currentSessionId}'`,
      );
      safeDeleteFile(
        this.logger,
        requestPath,
        `${location.label} forwarded permission request`,
      );
      return;
    }

    const forwardedPermissionLogDetails = {
      requestId: request.id,
      source: location.label,
      requesterAgentName: request.requesterAgentName,
      requesterSessionId: request.requesterSessionId,
      targetSessionId: request.targetSessionId,
      requestPath,
    };

    let decision: PermissionPromptDecision = {
      approved: false,
      state: "denied",
    };
    // Last yolo check outside the composed ruleset: dissolves when
    // processInbox is refactored onto evaluate() + Authorizer selection in
    // the Phase 9 spine work.
    if (isYoloModeEnabled(this.config.current())) {
      this.logger.review(
        "forwarded_permission.auto_approved",
        forwardedPermissionLogDetails,
      );
      decision = { approved: true, state: "approved" };
    } else {
      this.logger.review(
        "forwarded_permission.prompted",
        forwardedPermissionLogDetails,
      );
      try {
        const forwardedMessage = formatForwardedPermissionPrompt(request);
        if (this.events) {
          emitUiPromptEvent(
            this.events,
            buildForwardedUiPrompt({
              requestId: request.id,
              message: forwardedMessage,
              requesterAgentName: request.requesterAgentName || null,
              requesterSessionId: request.requesterSessionId || null,
              source: request.source ?? null,
              surface: request.surface ?? null,
              value: request.value ?? null,
            }),
          );
        }
        decision = await this.requestPermissionDecisionFromUi(
          ctx.ui,
          "Permission Required (Subagent)",
          forwardedMessage,
        );
      } catch (error) {
        logPermissionForwardingError(
          this.logger,
          "Failed to show forwarded permission confirmation dialog",
          error,
        );
        decision = { approved: false, state: "denied" };
      }
    }

    const responsePath = join(location.responsesDir, `${request.id}.json`);
    this.logger.review(
      decision.approved
        ? "forwarded_permission.approved"
        : "forwarded_permission.denied",
      {
        requestId: request.id,
        source: location.label,
        requesterAgentName: request.requesterAgentName,
        requesterSessionId: request.requesterSessionId,
        targetSessionId: request.targetSessionId,
        responsePath,
        resolution: decision.state,
        denialReason: decision.denialReason ?? null,
      },
    );
    try {
      writeJsonFileAtomic(this.logger, responsePath, {
        approved: decision.approved,
        state: decision.state,
        denialReason: decision.denialReason,
        responderSessionId: currentSessionId,
        respondedAt: Date.now(),
      } satisfies ForwardedPermissionResponse);
    } catch (error) {
      logPermissionForwardingError(
        this.logger,
        `Failed to write ${location.label} forwarded permission response '${responsePath}'`,
        error,
      );
      return;
    }

    safeDeleteFile(
      this.logger,
      requestPath,
      `${location.label} forwarded permission request`,
    );
  }
}
