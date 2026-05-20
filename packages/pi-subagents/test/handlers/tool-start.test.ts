import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolStartRuntime } from "../../src/handlers/tool-start.js";
import { ToolStartHandler } from "../../src/handlers/tool-start.js";

describe("ToolStartHandler", () => {
  let runtime: ToolStartRuntime;
  let handler: ToolStartHandler;

  beforeEach(() => {
    runtime = {
      setUICtx: vi.fn(),
      onTurnStart: vi.fn(),
    };
    handler = new ToolStartHandler(runtime);
  });

  describe("handleToolExecutionStart", () => {
    it("calls setUICtx with the context's ui", () => {
      const ui = { setStatus: vi.fn(), setWidget: vi.fn() };

      handler.handleToolExecutionStart({}, { ui });

      expect(runtime.setUICtx).toHaveBeenCalledWith(ui);
    });

    it("calls onTurnStart", () => {
      const ui = { setStatus: vi.fn(), setWidget: vi.fn() };

      handler.handleToolExecutionStart({}, { ui });

      expect(runtime.onTurnStart).toHaveBeenCalled();
    });

    it("calls setUICtx before onTurnStart", () => {
      const callOrder: string[] = [];
      (runtime.setUICtx as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push("setUICtx");
      });
      (runtime.onTurnStart as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push("onTurnStart");
      });

      const ui = { setStatus: vi.fn(), setWidget: vi.fn() };
      handler.handleToolExecutionStart({}, { ui });

      expect(callOrder).toEqual(["setUICtx", "onTurnStart"]);
    });
  });
});
