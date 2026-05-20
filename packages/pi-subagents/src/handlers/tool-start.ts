/**
 * tool_execution_start event handler.
 *
 * Extracted from index.ts so the handler can be tested in isolation
 * with a mocked narrow runtime interface.
 */

/** Narrow runtime interface — only the widget-delegation methods the handler calls. */
export interface ToolStartRuntime {
  setUICtx(ctx: unknown): void;
  onTurnStart(): void;
}

/** Minimal context shape for tool_execution_start — only the field the handler reads. */
interface ToolStartCtx {
  ui: unknown;
}

/**
 * Handles tool_execution_start events.
 *
 * Grabs UI context from the first tool execution of each turn
 * and signals the widget to clear lingering state.
 */
export class ToolStartHandler {
  constructor(private readonly runtime: ToolStartRuntime) {}

  handleToolExecutionStart(_event: unknown, ctx: ToolStartCtx): void {
    this.runtime.setUICtx(ctx.ui);
    this.runtime.onTurnStart();
  }
}
