import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SubagentDetector } from "./authority/subagent-detection";
import type { GatePrompter } from "./gate-prompter";
import type { PermissionPromptDecision } from "./permission-dialog";
import type {
  PermissionPrompterApi,
  PromptPermissionDetails,
} from "./permission-prompter";

/**
 * Dependencies required by PromptingGateway.
 *
 * All fields are actively consumed:
 * - `detection` drives `canConfirm()`.
 * - `prompter` is called by `prompt()`.
 */
export interface PromptingGatewayDeps {
  /** Single owner of subagent detection; drives `canConfirm()`. */
  detection: SubagentDetector;
  /** Resolves the permission decision: direct UI dialog or forwarded to parent. */
  prompter: PermissionPrompterApi;
}

/**
 * The lifecycle slice of the gateway that PermissionSession drives.
 *
 * PermissionSession calls activate/deactivate to keep the gateway's stored
 * context in sync with its own — the same pattern used for ForwardingController.
 */
export interface PromptingGatewayLifecycle {
  activate(ctx: ExtensionContext): void;
  deactivate(): void;
}

/**
 * Context-owning implementation of the GatePrompter role.
 *
 * Owns the stored ExtensionContext and the "can we prompt?" policy
 * (UI / subagent), replacing the four twin methods that previously
 * lived on PermissionSession.
 *
 * Lifecycle: PermissionSession drives activate/deactivate so the stored
 * context mirrors the session context without independent call-site changes.
 */
export class PromptingGateway
  implements GatePrompter, PromptingGatewayLifecycle
{
  private context: ExtensionContext | null = null;

  constructor(private readonly deps: PromptingGatewayDeps) {}

  /** Store the current extension context. */
  activate(ctx: ExtensionContext): void {
    this.context = ctx;
  }

  /** Clear the stored context. */
  deactivate(): void {
    this.context = null;
  }

  /**
   * Whether an interactive permission prompt can be shown.
   *
   * Returns false when no context is active. Otherwise true when the
   * context has UI or is a forwarding subagent — the two Authorizer-
   * selection predicates the Phase 9 spine will consume. Yolo-mode never
   * reaches this policy: it is resolved upstream at the composition stage.
   */
  canConfirm(): boolean {
    if (this.context === null) return false;
    return this.context.hasUI || this.deps.detection.isSubagent(this.context);
  }

  /**
   * Prompt the user for a permission decision using the stored context.
   *
   * Rejects if no context is active — canConfirm() guards this in normal use.
   * Implements {@link GatePrompter}.
   */
  prompt(details: PromptPermissionDetails): Promise<PermissionPromptDecision> {
    if (this.context === null) {
      return Promise.reject(
        new Error("prompt called before the session was activated"),
      );
    }
    return this.deps.prompter.prompt(this.context, details);
  }
}
