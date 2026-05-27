/**
 * record-observer.ts — Subscribes to session events and updates Agent stats.
 *
 * Replaces the scattered callback-wrapping logic in AgentManager's startAgent()
 * and resume() with a single direct subscription.
 */

import type { Agent } from "#src/lifecycle/agent";
import type { CompactionInfo } from "#src/lifecycle/agent-manager";
import type { SubscribableSession } from "#src/types";

export interface AgentObserverOptions {
  onCompact?: (record: Agent, info: CompactionInfo) => void;
}

/**
 * Subscribe to session events and accumulate stats on the agent record.
 *
 * Handles:
 * - `tool_execution_end` → `record.incrementToolUses()`
 * - `message_end` (assistant, with usage) → `record.addUsage(…)`
 * - `compaction_end` (not aborted) → `record.incrementCompactions()`, call `onCompact`
 *
 * @returns An unsubscribe function.
 */
export function subscribeAgentObserver(
  session: SubscribableSession,
  record: Agent,
  options?: AgentObserverOptions,
): () => void {
  return session.subscribe((event) => {
    if (event.type === "tool_execution_end") {
      record.incrementToolUses();
    }

    if (event.type === "message_end" && event.message.role === "assistant") {
      const u = event.message.usage;
      record.addUsage({
        input: u.input,
        output: u.output,
        cacheWrite: u.cacheWrite,
      });
    }

    if (event.type === "compaction_end" && !event.aborted && event.result) {
      record.incrementCompactions();
      options?.onCompact?.(record, {
        reason: event.reason,
        tokensBefore: event.result.tokensBefore,
      });
    }
  });
}
