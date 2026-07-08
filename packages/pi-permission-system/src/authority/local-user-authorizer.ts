import type {
  PermissionDecisionUi,
  PermissionPromptDecision,
  requestPermissionDecisionFromUi,
} from "#src/permission-dialog";
import {
  emitUiPromptEvent,
  type PermissionEventBus,
} from "#src/permission-events";
import { buildDirectUiPrompt } from "#src/permission-ui-prompt";
import type { Authorizer } from "./authorizer";
import type { PromptPermissionDetails } from "./permission-prompter";

/** Dependencies required by {@link LocalUserAuthorizer}. */
export interface LocalUserAuthorizerDeps {
  /** The active session's UI surface. */
  ui: PermissionDecisionUi;
  /** Event bus used for the `permissions:ui_prompt` broadcast. */
  events: PermissionEventBus;
  /** Injected for testability; production callers pass the real function. */
  requestPermissionDecisionFromUi: typeof requestPermissionDecisionFromUi;
}

/**
 * Authorizer for a session with an active UI: prompt the human here.
 *
 * Emits the `permissions:ui_prompt` broadcast (moved here from
 * `PermissionPrompter`'s `ctx.hasUI` arm) before showing the dialog, so
 * observers know a decision is imminent.
 */
export class LocalUserAuthorizer implements Authorizer {
  constructor(private readonly deps: LocalUserAuthorizerDeps) {}

  authorize(
    details: PromptPermissionDetails,
  ): Promise<PermissionPromptDecision> {
    const uiPrompt = buildDirectUiPrompt(details);
    emitUiPromptEvent(this.deps.events, uiPrompt);
    return this.deps.requestPermissionDecisionFromUi(
      this.deps.ui,
      "Permission Required",
      details.message,
      details.sessionLabel ? { sessionLabel: details.sessionLabel } : undefined,
    );
  }
}
