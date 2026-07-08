import type { PermissionPromptDecision } from "#src/permission-dialog";
import type { ReviewLogger } from "#src/session-logger";
import type { Authorizer } from "./authorizer";

export type PermissionReviewSource = "tool_call" | "skill_input" | "skill_read";

/** Details passed when prompting the user for a permission decision. */
export interface PromptPermissionDetails {
  requestId: string;
  source: PermissionReviewSource;
  agentName: string | null;
  message: string;
  toolCallId?: string;
  toolName?: string;
  skillName?: string;
  path?: string;
  command?: string;
  target?: string;
  toolInputPreview?: string;
  /** Override label for the "for this session" dialog option. */
  sessionLabel?: string;
}

/**
 * Narrow seam onto {@link PermissionPrompter}.
 *
 * Kept separate from the concrete class so consumers (e.g. `AuthorizerSelection`)
 * can inject a plain `{ prompt: vi.fn() }` mock in tests — a private field on
 * the concrete class would create a nominal brand that a structural mock
 * cannot satisfy without a cast.
 */
export interface PermissionPrompterApi {
  prompt(
    authorizer: Authorizer,
    details: PromptPermissionDetails,
  ): Promise<PermissionPromptDecision>;
}

/** Dependencies required by {@link PermissionPrompter}. */
export interface PermissionPrompterDeps {
  /** Write structured entries to the permission review log. */
  logger: ReviewLogger;
}

/**
 * Brackets the ask-path flow with review-log entries and delegates the
 * live decision to the selected {@link Authorizer}:
 *   1. Review-log "waiting" entry.
 *   2. `authorizer.authorize(details)`.
 *   3. Review-log "approved" / "denied" entry.
 *
 * The UI/forwarding branching this class previously owned now lives on the
 * individual `Authorizer` implementations (`LocalUserAuthorizer`,
 * `ParentAuthorizer`, `DenyingAuthorizer`) — this class no longer threads
 * `ExtensionContext` per call.
 *
 * Yolo-mode auto-approval happens upstream, at the composition stage
 * (`PermissionManager.check`'s `rewriteAsksToYolo`) — an `ask` never reaches
 * this class under yolo, so this class has no yolo-mode knowledge.
 */
export class PermissionPrompter implements PermissionPrompterApi {
  constructor(private readonly deps: PermissionPrompterDeps) {}

  async prompt(
    authorizer: Authorizer,
    details: PromptPermissionDetails,
  ): Promise<PermissionPromptDecision> {
    this.writeReviewEntry("permission_request.waiting", details);

    const decision = await authorizer.authorize(details);

    this.writeReviewEntry(
      decision.approved
        ? "permission_request.approved"
        : "permission_request.denied",
      {
        ...details,
        resolution: decision.confirmationUnavailable
          ? "confirmation_unavailable"
          : decision.state,
        denialReason: decision.denialReason,
      },
    );

    return decision;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private writeReviewEntry(
    event: string,
    details: PromptPermissionDetails & {
      resolution?: string;
      denialReason?: string;
    },
  ): void {
    this.deps.logger.review(event, {
      requestId: details.requestId,
      source: details.source,
      agentName: details.agentName,
      message: details.message,
      toolCallId: details.toolCallId ?? null,
      toolName: details.toolName ?? null,
      skillName: details.skillName ?? null,
      path: details.path ?? null,
      command: details.command ?? null,
      target: details.target ?? null,
      toolInputPreview: details.toolInputPreview ?? null,
      resolution: details.resolution ?? null,
      denialReason: details.denialReason ?? null,
    });
  }
}
