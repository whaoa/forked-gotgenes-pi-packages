import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { GatePrompter } from "#src/gate-prompter";
import type { PermissionPromptDecision } from "#src/permission-dialog";
import {
  type Authorizer,
  type AuthorizerSelectionDeps,
  selectAuthorizer,
} from "./authorizer";
import type {
  PermissionPrompterApi,
  PromptPermissionDetails,
} from "./permission-prompter";

/**
 * The lifecycle slice of the selection owner that PermissionSession drives.
 *
 * PermissionSession calls activate/deactivate to keep the selection's stored
 * context in sync with its own — the same pattern the former
 * PromptingGatewayLifecycle used.
 */
export interface AuthorizerSelectionLifecycle {
  activate(ctx: ExtensionContext): void;
  deactivate(): void;
}

/**
 * Context-owning selection root for the Authorizer spine.
 *
 * The rewrite of `PromptingGateway`: owns the stored `ExtensionContext`, runs
 * `selectAuthorizer` once per activation, and implements `GatePrompter` by
 * delegating to the selected `Authorizer` via `PermissionPrompter`.
 *
 * `canConfirm()` survives this step (dissolved in #556): it is recomputed
 * transitionally alongside `selectAuthorizer`'s own branch, rather than
 * derived from the selected authorizer, to keep the ask path byte-identical
 * until #556 derives confirmability from a `DenyingAuthorizer` marker.
 */
export class AuthorizerSelection
  implements GatePrompter, AuthorizerSelectionLifecycle
{
  private selected: Authorizer | null = null;
  private confirmable = false;

  constructor(
    private readonly deps: AuthorizerSelectionDeps & {
      prompter: PermissionPrompterApi;
    },
  ) {}

  /** Select the Authorizer for `ctx` and store both it and the confirmable predicate. */
  activate(ctx: ExtensionContext): void {
    this.selected = selectAuthorizer(ctx, this.deps);
    this.confirmable = ctx.hasUI || this.deps.detection.isSubagent(ctx);
  }

  /** Clear the stored selection. */
  deactivate(): void {
    this.selected = null;
    this.confirmable = false;
  }

  /**
   * Whether an interactive permission prompt can be shown.
   *
   * Returns false when no authorizer has been selected. Otherwise true when
   * the context had UI or was a forwarding subagent at selection time — the
   * two Authorizer-selection predicates, evaluated once at `activate`.
   */
  canConfirm(): boolean {
    return this.selected !== null && this.confirmable;
  }

  /**
   * Prompt for a permission decision using the selected authorizer.
   *
   * Rejects if no authorizer has been selected — `canConfirm()` guards this
   * in normal use. Implements {@link GatePrompter}.
   */
  prompt(details: PromptPermissionDetails): Promise<PermissionPromptDecision> {
    if (this.selected === null) {
      return Promise.reject(
        new Error("prompt called before the session was activated"),
      );
    }
    return this.deps.prompter.prompt(this.selected, details);
  }
}
