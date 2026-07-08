import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  getActiveAgentName,
  getActiveAgentNameFromSystemPrompt,
} from "#src/active-agent";
import {
  type ForwarderContext,
  getSessionId,
} from "#src/authority/forwarder-context";
import {
  cleanupPermissionForwardingLocationIfEmpty,
  ensurePermissionForwardingLocation,
  logPermissionForwardingError,
  logPermissionForwardingWarning,
  readForwardedPermissionResponse,
  safeDeleteFile,
  sleep,
  writeJsonFileAtomic,
} from "#src/authority/forwarding-io";
import type { SubagentDetector } from "#src/authority/subagent-detection";
import type {
  PermissionDecisionUi,
  PermissionPromptDecision,
  RequestPermissionOptions,
} from "#src/permission-dialog";
import {
  type ForwardedPermissionRequest,
  type ForwardedPromptDisplay,
  PERMISSION_FORWARDING_POLL_INTERVAL_MS,
  PERMISSION_FORWARDING_TIMEOUT_MS,
  type PermissionForwardingLocation,
  resolvePermissionForwardingTargetSessionId,
  SUBAGENT_PARENT_SESSION_ENV_CANDIDATES,
} from "#src/permission-forwarding";
import { buildDirectUiPrompt } from "#src/permission-ui-prompt";
import type { DebugReviewLogger } from "#src/session-logger";
import type { SubagentSessionRegistry } from "#src/subagent-registry";
import { toRecord } from "#src/value-guards";
import type { Authorizer } from "./authorizer";
import type { PromptPermissionDetails } from "./permission-prompter";

/**
 * Constructor config for `ApprovalEscalator`.
 *
 * Replaces the `PermissionForwardingDeps` interface that was previously
 * threaded into free functions in `polling.ts`.  The escalator consumes it
 * once at construction and stores each member as a private readonly field.
 */
export interface ApprovalEscalatorDeps {
  forwardingDir: string;
  /** Single owner of subagent detection; gates the forward-vs-deny decision. */
  detection: SubagentDetector;
  /** In-process subagent session registry for forwarding target resolution. */
  registry?: SubagentSessionRegistry;
  logger: DebugReviewLogger;
  requestPermissionDecisionFromUi: (
    ui: PermissionDecisionUi,
    title: string,
    message: string,
    options?: RequestPermissionOptions,
  ) => Promise<PermissionPromptDecision>;
}

// ── Module-private helpers ────────────────────────────────────────────────

function getContextSystemPrompt(ctx: ForwarderContext): string | undefined {
  const getSystemPrompt = toRecord(ctx).getSystemPrompt;
  if (typeof getSystemPrompt !== "function") {
    return undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- getSystemPrompt is a Pi SDK accessor returning any
    const systemPrompt = getSystemPrompt.call(ctx);
    return typeof systemPrompt === "string" ? systemPrompt : undefined;
  } catch (error) {
    // No deps available in this helper — warning silently dropped.
    logPermissionForwardingWarning(
      null,
      "Failed to read context system prompt for forwarded permission metadata",
      error,
    );
    return undefined;
  }
}

// ── Public seam interfaces ────────────────────────────────────────────────

/**
 * Narrow seam describing what `PermissionPrompter` needs from the escalator:
 * a single method that resolves a permission decision for the current context
 * (prompt directly when the session has UI, otherwise forward to the parent).
 *
 * Depending on the interface (not the concrete `ApprovalEscalator`) keeps
 * the prompter's unit tests free of casts — they inject a plain
 * `{ requestApproval: vi.fn() }` mock.
 */
export interface ApprovalRequester {
  requestApproval(
    ctx: ForwarderContext,
    message: string,
    options?: RequestPermissionOptions,
    forwarded?: ForwardedPromptDisplay,
  ): Promise<PermissionPromptDecision>;
}

// ── ApprovalEscalator ────────────────────────────────────────────────

/**
 * Owner of the escalation-up role of the forwarded-permission behavior.
 *
 * Holds all forwarding state as private readonly fields and provides the
 * public `requestApproval` method: deciding whether to prompt directly or
 * forward to the parent, building and persisting request files, and polling
 * for responses.
 */
export class ApprovalEscalator implements ApprovalRequester {
  private readonly forwardingDir: string;
  private readonly detection: SubagentDetector;
  private readonly registry: SubagentSessionRegistry | undefined;
  private readonly logger: DebugReviewLogger;
  private readonly requestPermissionDecisionFromUi: (
    ui: PermissionDecisionUi,
    title: string,
    message: string,
    options?: RequestPermissionOptions,
  ) => Promise<PermissionPromptDecision>;

  constructor(deps: ApprovalEscalatorDeps) {
    this.forwardingDir = deps.forwardingDir;
    this.detection = deps.detection;
    this.registry = deps.registry;
    this.logger = deps.logger;
    this.requestPermissionDecisionFromUi = deps.requestPermissionDecisionFromUi;
  }

  // ── Public seam methods ────────────────────────────────────────────────

  /**
   * Resolve a permission decision for the current context: prompt directly
   * when this session has UI, otherwise forward to the parent session.
   */
  requestApproval(
    ctx: ForwarderContext,
    message: string,
    options?: RequestPermissionOptions,
    forwarded?: ForwardedPromptDisplay,
  ): Promise<PermissionPromptDecision> {
    if (ctx.hasUI) {
      return this.requestPermissionDecisionFromUi(
        ctx.ui,
        "Permission Required",
        message,
        options,
      );
    }

    if (!this.detection.isSubagent(ctx)) {
      return Promise.resolve({ approved: false, state: "denied" });
    }

    return this.waitForForwardedApproval(ctx, message, forwarded);
  }

  // ── Private methods ────────────────────────────────────────────────────

  private async waitForForwardedApproval(
    ctx: ForwarderContext,
    message: string,
    forwarded?: ForwardedPromptDisplay,
  ): Promise<PermissionPromptDecision> {
    const requesterSessionId = getSessionId(ctx);
    const targetSessionId = resolvePermissionForwardingTargetSessionId({
      hasUI: ctx.hasUI,
      isSubagent: this.detection.isSubagent(ctx),
      currentSessionId: requesterSessionId,
      env: process.env,
      sessionId: requesterSessionId,
      registry: this.registry,
    });

    if (!targetSessionId) {
      logPermissionForwardingError(
        this.logger,
        `Permission forwarding target session could not be resolved. ` +
          `Checked env vars: ${SUBAGENT_PARENT_SESSION_ENV_CANDIDATES.join(", ")}. ` +
          `If you are using a subagent extension (nicobailon/pi-subagents, HazAT/pi-interactive-subagents, etc.), ` +
          `ask its maintainer to set PI_SUBAGENT_PARENT_SESSION in the child process environment ` +
          `(see https://github.com/gotgenes/pi-permission-system/issues/143).`,
      );
      return { approved: false, state: "denied" };
    }

    const location = ensurePermissionForwardingLocation(
      this.logger,
      this.forwardingDir,
      targetSessionId,
    );
    if (!location) {
      logPermissionForwardingError(
        this.logger,
        `Permission forwarding is unavailable because session-scoped directories could not be prepared for '${targetSessionId}'`,
      );
      return { approved: false, state: "denied" };
    }

    const request = this.buildForwardedRequest(
      ctx,
      message,
      requesterSessionId,
      targetSessionId,
      forwarded,
    );
    const requestPath = join(location.requestsDir, `${request.id}.json`);
    const responsePath = join(location.responsesDir, `${request.id}.json`);

    this.logger.review("forwarded_permission.request_created", {
      requestId: request.id,
      requesterAgentName: request.requesterAgentName,
      requesterSessionId: request.requesterSessionId,
      targetSessionId,
      requestPath,
      responsePath,
    });

    try {
      writeJsonFileAtomic(this.logger, requestPath, request);
    } catch (error) {
      logPermissionForwardingError(
        this.logger,
        `Failed to write forwarded permission request '${requestPath}'`,
        error,
      );
      return { approved: false, state: "denied" };
    }

    return this.pollForForwardedResponse(
      location,
      request,
      requestPath,
      responsePath,
    );
  }

  private buildForwardedRequest(
    ctx: ForwarderContext,
    message: string,
    requesterSessionId: string,
    targetSessionId: string,
    forwarded?: ForwardedPromptDisplay,
  ): ForwardedPermissionRequest {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.pid}`;
    const requesterAgentName =
      getActiveAgentName(ctx) ??
      getActiveAgentNameFromSystemPrompt(getContextSystemPrompt(ctx)) ??
      "unknown";
    return {
      id: requestId,
      createdAt: Date.now(),
      requesterSessionId,
      targetSessionId,
      requesterAgentName,
      message,
      ...(forwarded
        ? {
            source: forwarded.source,
            surface: forwarded.surface,
            value: forwarded.value,
          }
        : {}),
    };
  }

  private async pollForForwardedResponse(
    location: PermissionForwardingLocation,
    request: ForwardedPermissionRequest,
    requestPath: string,
    responsePath: string,
  ): Promise<PermissionPromptDecision> {
    const { id: requestId, requesterAgentName, targetSessionId } = request;
    const deadline = Date.now() + PERMISSION_FORWARDING_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (existsSync(responsePath)) {
        const response = readForwardedPermissionResponse(
          this.logger,
          responsePath,
        );
        this.logger.review("forwarded_permission.response_received", {
          requestId,
          approved: response?.approved ?? null,
          state: response?.state ?? null,
          denialReason: response?.denialReason ?? null,
          responderSessionId: response?.responderSessionId ?? null,
          targetSessionId,
          responsePath,
        });
        safeDeleteFile(
          this.logger,
          responsePath,
          "forwarded permission response",
        );
        safeDeleteFile(
          this.logger,
          requestPath,
          "forwarded permission request",
        );
        cleanupPermissionForwardingLocationIfEmpty(this.logger, location);
        return response ?? { approved: false, state: "denied" };
      }

      await sleep(PERMISSION_FORWARDING_POLL_INTERVAL_MS);
    }

    logPermissionForwardingWarning(
      this.logger,
      `Timed out waiting for forwarded permission response '${responsePath}'`,
    );
    this.logger.review("forwarded_permission.response_timed_out", {
      requestId,
      requesterAgentName,
      targetSessionId,
      responsePath,
    });
    safeDeleteFile(this.logger, requestPath, "forwarded permission request");
    cleanupPermissionForwardingLocationIfEmpty(this.logger, location);
    return { approved: false, state: "denied" };
  }
}

// ── ParentAuthorizer ──────────────────────────────────────────

/**
 * Authorizer for a subagent session: escalate the ask up the tree to the
 * parent's authority.
 *
 * Step 1 (#555) wraps an existing `ApprovalEscalator` instance, binding
 * `ctx` once at construction instead of threading it per call. Step 2 folds
 * the escalator's forwarding machinery directly into this class and removes
 * this wrapper plus the now-dead `ctx.hasUI` / `!isSubagent` arms on
 * `ApprovalEscalator` (see the #555 plan) — this constructor shape is
 * transitional, not the final one.
 */
export class ParentAuthorizer implements Authorizer {
  constructor(
    private readonly ctx: ForwarderContext,
    private readonly escalator: ApprovalRequester,
  ) {}

  authorize(
    details: PromptPermissionDetails,
  ): Promise<PermissionPromptDecision> {
    const uiPrompt = buildDirectUiPrompt(details);
    return this.escalator.requestApproval(
      this.ctx,
      details.message,
      details.sessionLabel ? { sessionLabel: details.sessionLabel } : undefined,
      {
        source: uiPrompt.source,
        surface: uiPrompt.surface,
        value: uiPrompt.value,
      },
    );
  }
}
