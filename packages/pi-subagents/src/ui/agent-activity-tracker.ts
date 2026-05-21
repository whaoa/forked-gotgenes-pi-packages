/**
 * agent-activity-tracker.ts — Per-agent live activity state with explicit transition methods.
 *
 * Replaces the mutable `AgentActivity` interface that was written via output arguments
 * in `ui-observer.ts`. Callers use named transition methods; readers use read-only accessors.
 */

import { addUsage, type LifetimeUsage, type SessionLike } from "../usage.js";

/** Usage delta accepted by onUsageUpdate — matches the LifetimeUsage accumulator shape. */
export interface UsageDelta {
	input: number;
	output: number;
	cacheWrite: number;
}

/** Per-agent live activity state with explicit transition methods and read-only accessors. */
export class AgentActivityTracker {
	private _activeTools = new Map<string, string>();
	private _toolKeySeq = 0;
	private _toolUses = 0;
	private _responseText = "";
	private _session: SessionLike | undefined = undefined;
	private _turnCount = 1;
	private _lifetimeUsage: LifetimeUsage = { input: 0, output: 0, cacheWrite: 0 };

	constructor(private readonly _maxTurns?: number) {}

	// ── Transition methods (write surface) ──────────────────────────────────

	/** Record that a tool has started executing. */
	onToolStart(toolName: string): void {
		this._activeTools.set(toolName + "_" + (++this._toolKeySeq), toolName);
	}

	/** Record that a tool has finished executing; increments toolUses. No-op when no matching tool is active. */
	onToolEnd(toolName: string): void {
		for (const [key, name] of this._activeTools) {
			if (name === toolName) {
				this._activeTools.delete(key);
				this._toolUses++;
				break;
			}
		}
	}

	/** Reset the current response text (called at the start of each assistant message). */
	onMessageStart(): void {
		this._responseText = "";
	}

	/** Append a text delta to the current response text. */
	onMessageUpdate(delta: string): void {
		this._responseText += delta;
	}

	/** Record that a turn has ended; increments turnCount. */
	onTurnEnd(): void {
		this._turnCount++;
	}

	/** Accumulate a usage delta into the lifetime usage totals. */
	onUsageUpdate(delta: UsageDelta): void {
		addUsage(this._lifetimeUsage, delta);
	}

	/** Bind the session reference (called once when the agent session is created). */
	setSession(session: SessionLike): void {
		this._session = session;
	}

	// ── Read-only accessors ──────────────────────────────────────────────────

	/** Currently-active tools: key → tool name. Multiple entries for concurrent same-name tools. */
	get activeTools(): ReadonlyMap<string, string> {
		return this._activeTools;
	}

	/** Total completed tool invocations. */
	get toolUses(): number {
		return this._toolUses;
	}

	/** The agent's latest partial response text (reset at each message start). */
	get responseText(): string {
		return this._responseText;
	}

	/** The active SDK session, or undefined before the first session is created. */
	get session(): SessionLike | undefined {
		return this._session;
	}

	/** Current turn count (starts at 1). */
	get turnCount(): number {
		return this._turnCount;
	}

	/** Effective max turns for this agent, or undefined for unlimited. */
	get maxTurns(): number | undefined {
		return this._maxTurns;
	}

	/** Accumulated lifetime token usage (survives compaction). */
	get lifetimeUsage(): Readonly<LifetimeUsage> {
		return this._lifetimeUsage;
	}
}
