/**
 * Centralized construction for `permissions:ui_prompt` payloads.
 *
 * Every emit site builds its event through one of these functions, so the
 * public contract's shape — including the normalized `surface`/`value`
 * projection — lives in exactly one place and cannot drift by source.
 *
 * This module is a leaf: it owns narrow input types that each call site's
 * domain object satisfies structurally, so it imports nothing from the
 * prompter or forwarding modules (no import cycles, correct layering).
 */

import type {
  ForwardedPromptContext,
  PermissionUiPromptEvent,
  PermissionUiPromptSource,
} from "./permission-events";

/** Input for a direct (non-forwarded) tool or skill prompt. */
export interface DirectPromptInput {
  requestId: string;
  source: "tool_call" | "skill_input" | "skill_read";
  agentName: string | null;
  message: string;
  toolName?: string;
  skillName?: string;
  path?: string;
  command?: string;
  target?: string;
}

/** Input for a file-forwarded subagent prompt shown by the parent UI. */
export interface ForwardedPromptInput {
  requestId: string;
  message: string;
  requesterAgentName: string | null;
  requesterSessionId: string | null;
  /** Original prompt origin, when the forwarded request carries it. */
  source?: PermissionUiPromptSource | null;
  /** Original normalized surface, when the forwarded request carries it. */
  surface?: string | null;
  /** Original normalized value, when the forwarded request carries it. */
  value?: string | null;
}

/**
 * Input for any UI prompt — direct or forwarded.
 *
 * A direct prompt supplies only the `DirectPromptInput` fields and lets
 * `surface`/`value` derive and `forwarding` default to `null`; a forwarded ask
 * supplies the child's original `surface`/`value` projection explicitly and a
 * populated `forwarding` context, so the parent's broadcast stays non-degraded
 * (the #292 contract hardening).
 */
export interface UiPromptInput extends DirectPromptInput {
  /** Explicit display surface; falls back to the derived projection when omitted. */
  surface?: string | null;
  /** Explicit display value; falls back to the derived projection when omitted. */
  value?: string | null;
  /** Forwarding context for a forwarded subagent ask; `null`/omitted for a direct prompt. */
  forwarding?: ForwardedPromptContext | null;
}

/**
 * Build a `permissions:ui_prompt` event from either a direct or a forwarded ask.
 *
 * `surface`/`value` use the explicit override when the caller sets them (an
 * explicit `null` is honored, not treated as "derive"); otherwise they fall
 * back to the direct-prompt projection. `forwarding` passes through, defaulting
 * to `null`.
 */
export function buildUiPrompt(input: UiPromptInput): PermissionUiPromptEvent {
  return {
    requestId: input.requestId,
    source: input.source,
    surface: input.surface !== undefined ? input.surface : directSurface(input),
    value: input.value !== undefined ? input.value : directValue(input),
    agentName: input.agentName,
    message: input.message,
    forwarding: input.forwarding ?? null,
  };
}

/** Normalized display surface for a direct prompt. */
function directSurface(input: DirectPromptInput): string | null {
  if (input.source === "skill_input" || input.source === "skill_read") {
    return "skill";
  }
  return input.toolName ?? null;
}

/** Normalized display value for a direct prompt. */
function directValue(input: DirectPromptInput): string | null {
  return (
    input.command ??
    input.path ??
    input.target ??
    input.skillName ??
    input.toolName ??
    null
  );
}

/**
 * Build the UI prompt event for a direct tool/skill prompt.
 *
 * Thin wrapper over {@link buildUiPrompt}; folds into it once
 * `forwarded-request-server` stops importing the two-builder split (#557 step 2).
 */
export function buildDirectUiPrompt(
  input: DirectPromptInput,
): PermissionUiPromptEvent {
  return buildUiPrompt(input);
}

/**
 * Build the UI prompt event for a file-forwarded subagent prompt.
 *
 * `source` defaults to `"tool_call"` (the dominant forwarded origin) when the
 * persisted request predates carrying it — a parent on a newer version may read
 * a request written by an older child during an upgrade. The consumer still
 * receives the notify-now signal, message, and forwarding context.
 */
export function buildForwardedUiPrompt(
  input: ForwardedPromptInput,
): PermissionUiPromptEvent {
  return {
    requestId: input.requestId,
    source: input.source ?? "tool_call",
    surface: input.surface ?? null,
    value: input.value ?? null,
    agentName: input.requesterAgentName,
    message: input.message,
    forwarding: {
      requesterAgentName: input.requesterAgentName,
      requesterSessionId: input.requesterSessionId,
    },
  };
}
