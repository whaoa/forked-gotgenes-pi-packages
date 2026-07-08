import type { PromptPermissionDetails } from "./authority/permission-prompter";
import type { PermissionPromptDecision } from "./permission-dialog";

/**
 * The prompting role the gate runner needs: a yes/no on whether an
 * interactive confirmation is possible, and the prompt itself. The context
 * is bound by the implementor, not threaded per call.
 */
export interface GatePrompter {
  canConfirm(): boolean;
  prompt(details: PromptPermissionDetails): Promise<PermissionPromptDecision>;
}
