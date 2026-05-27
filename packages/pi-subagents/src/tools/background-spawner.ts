import type { AgentSpawnConfig, ParentSessionInfo } from "#src/lifecycle/agent-manager";
import type { ParentSnapshot } from "#src/lifecycle/parent-snapshot";
import type { AgentActivityAccess } from "#src/tools/agent-tool";
import { textResult } from "#src/tools/helpers";
import type { ResolvedSpawnConfig } from "#src/tools/spawn-config";
import type { Agent } from "#src/types";
import { AgentActivityTracker } from "#src/ui/agent-activity-tracker";
import { subscribeUIObserver } from "#src/ui/ui-observer";

/** Narrow manager interface for the background spawner. */
export interface BackgroundManagerDeps {
  spawn(snapshot: ParentSnapshot, type: string, prompt: string, opts: AgentSpawnConfig): string;
  getRecord(id: string): Agent | undefined;
}

/** Narrow widget interface for the background spawner. */
export interface BackgroundWidgetDeps {
  ensureTimer(): void;
  update(): void;
}

/** All values the background spawner needs beyond the resolved config. */
export interface BackgroundParams {
  config: ResolvedSpawnConfig;
  snapshot: ParentSnapshot;
  parentSession: ParentSessionInfo;
  settings: { readonly maxConcurrent: number };
}

/**
 * Spawn a background agent and return the tool result immediately.
 * Owns: activity tracker creation, UI observer subscription, activity map
 * registration, widget update, and launch message formatting.
 */
export function spawnBackground(
  manager: BackgroundManagerDeps,
  widget: BackgroundWidgetDeps,
  agentActivity: AgentActivityAccess,
  params: BackgroundParams,
) {
  const { identity, execution, presentation } = params.config;
  const bgState = new AgentActivityTracker(execution.effectiveMaxTurns);

  let id: string;
  try {
    id = manager.spawn(params.snapshot, identity.subagentType, execution.prompt, {
      parentSession: params.parentSession,
      description: execution.description,
      model: execution.model,
      maxTurns: execution.effectiveMaxTurns,
      isolated: execution.isolated,
      inheritContext: execution.inheritContext,
      thinkingLevel: execution.thinking,
      isBackground: true,
      isolation: execution.isolation,
      invocation: execution.agentInvocation,
      onSessionCreated: (session) => {
        bgState.setSession(session);
        subscribeUIObserver(session, bgState);
      },
    });
  } catch (err) {
    return textResult(err instanceof Error ? err.message : String(err));
  }

  const record = manager.getRecord(id);

  agentActivity.set(id, bgState);
  widget.ensureTimer();
  widget.update();

  const isQueued = record?.status === "queued";
  return textResult(
    `Agent ${isQueued ? "queued" : "started"} in background.\n` +
      `Agent ID: ${id}\n` +
      `Type: ${identity.displayName}\n` +
      `Description: ${execution.description}\n` +
      (record?.outputFile ? `Output file: ${record.outputFile}\n` : "") +
      (isQueued
        ? `Position: queued (max ${params.settings.maxConcurrent} concurrent)\n`
        : "") +
      `\nYou will be notified when this agent completes.\n` +
      `Use get_subagent_result to retrieve full results, or steer_subagent to send it messages.\n` +
      `Do not duplicate this agent's work.`,
    {
      ...presentation.detailBase,
      toolUses: 0,
      tokens: "",
      durationMs: 0,
      status: "background" as const,
      agentId: id,
    },
  );
}
