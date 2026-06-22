/**
 * session-navigator.ts — The `/subagent-sessions` command: pick a subagent and
 * read its transcript through Pi's own session-rendering text.
 *
 * SDK/TUI consumer half of native session navigation. The unit-testable core
 * (selection, sourcing, text rendering) lives in `session-navigation.ts`; this
 * module wires that core to the command picker and a read-only scrollable overlay.
 *
 * The overlay is strictly read-only — steering stays in the `steer_subagent` tool
 * and the widget. It consumes a `TranscriptSource`, so the renderer-upgrade and
 * evicted-agent-source follow-ups swap the source/renderer without touching it.
 */

import { type Component, matchesKey, type TUI, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { AgentConfigLookup } from "#src/config/agent-types";
import type { Theme } from "#src/ui/display";
import {
  listNavigableAgents,
  liveSource,
  type NavigableSubagent,
  renderTranscriptLines,
  type TranscriptSource,
} from "#src/ui/session-navigation";

// ─────────────────────────────────────────────────────────────────────────────

/** Chrome lines: top border + header + header sep + footer sep + footer + bottom border. */
const CHROME_LINES = 6;
const MIN_VIEWPORT = 3;
const VIEWPORT_HEIGHT_PCT = 70;

/** Component factory shape Pi's `ui.custom` invokes to mount an overlay. */
export type OverlayComponentFactory<R> = (
  tui: TUI,
  theme: Theme,
  keybindings: unknown,
  done: (result: R) => void,
) => Component;

/** Narrow UI interface — only the `ctx.ui` methods the navigator calls. */
export interface SessionNavigatorUI {
  select(title: string, options: string[]): Promise<string | undefined>;
  notify(message: string, level: "info" | "warning" | "error"): void;
  custom<R>(component: OverlayComponentFactory<R>, options?: unknown): Promise<R>;
}

/** Parameters for one `/subagent-sessions` invocation. */
export interface SessionNavigatorParams {
  ui: SessionNavigatorUI;
  agents: readonly NavigableSubagent[];
  registry: AgentConfigLookup;
}

/** Options for the read-only transcript overlay. */
export interface TranscriptOverlayOptions {
  tui: TUI;
  theme: Theme;
  source: TranscriptSource;
  done: (result: undefined) => void;
  wrapText: (text: string, width: number) => string[];
}

/**
 * Handler for the `/subagent-sessions` slash command.
 *
 * Lists navigable subagents, lets the operator pick one, and opens its transcript
 * read-only. Receives the agent snapshot (`manager.listAgents()`) rather than the
 * manager, so it stays a reactive consumer with no inbound call into the core.
 */
export class SessionNavigatorHandler {
  async handle({ ui, agents, registry }: SessionNavigatorParams): Promise<void> {
    const entries = listNavigableAgents(agents, registry);
    if (entries.length === 0) {
      ui.notify("No subagent sessions to view.", "info");
      return;
    }

    const choice = await ui.select(
      "Subagent sessions",
      entries.map((entry) => entry.label),
    );
    const entry = entries.find((candidate) => candidate.label === choice);
    if (!entry) return;

    const source = liveSource(entry.record);
    await ui.custom<undefined>(
      (tui, theme, _keybindings, done) =>
        new TranscriptOverlay({ tui, theme, source, done, wrapText: wrapTextWithAnsi }),
      {
        overlay: true,
        overlayOptions: { anchor: "center", width: "90%", maxHeight: `${VIEWPORT_HEIGHT_PCT}%` },
      },
    );
  }
}

/**
 * Read-only scrollable transcript overlay.
 *
 * Re-renders on every source update (live agents); the transcript text is Pi's
 * `serializeConversation` output from `renderTranscriptLines` — this class owns
 * only scroll state and chrome, no message formatting.
 */
export class TranscriptOverlay implements Component {
  private scrollOffset = 0;
  private autoScroll = true;
  private unsubscribe: (() => void) | undefined;
  private closed = false;

  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly source: TranscriptSource;
  private readonly done: (result: undefined) => void;
  private readonly wrapText: (text: string, width: number) => string[];

  constructor({ tui, theme, source, done, wrapText }: TranscriptOverlayOptions) {
    this.tui = tui;
    this.theme = theme;
    this.source = source;
    this.done = done;
    this.wrapText = wrapText;
    this.unsubscribe = source.subscribe(() => {
      if (this.closed) return;
      this.tui.requestRender();
    });
  }

  // fallow-ignore-next-line unused-class-member
  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
      this.closed = true;
      this.done(undefined);
      return;
    }

    const totalLines = this.buildContentLines(this.innerWidth()).length;
    const viewportHeight = this.viewportHeight();
    const maxScroll = Math.max(0, totalLines - viewportHeight);

    if (matchesKey(data, "up") || matchesKey(data, "k")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "down") || matchesKey(data, "j")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "pageUp") || matchesKey(data, "shift+up")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - viewportHeight);
      this.autoScroll = false;
    } else if (matchesKey(data, "pageDown") || matchesKey(data, "shift+down")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + viewportHeight);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "home")) {
      this.scrollOffset = 0;
      this.autoScroll = false;
    } else if (matchesKey(data, "end")) {
      this.scrollOffset = maxScroll;
      this.autoScroll = true;
    }
  }

  render(width: number): string[] {
    if (width < 6) return [];
    const th = this.theme;
    const innerW = width - 4;
    const lines: string[] = [];

    const pad = (s: string, len: number): string => s + " ".repeat(Math.max(0, len - visibleWidth(s)));
    const row = (content: string): string =>
      th.fg("border", "│") + " " + truncateToWidth(pad(content, innerW), innerW) + " " + th.fg("border", "│");
    const hrTop = th.fg("border", `╭${"─".repeat(width - 2)}╮`);
    const hrBot = th.fg("border", `╰${"─".repeat(width - 2)}╯`);
    const hrMid = row(th.fg("dim", "─".repeat(innerW)));

    lines.push(hrTop);
    lines.push(row(th.bold("Subagent session")));
    lines.push(hrMid);

    const contentLines = this.buildContentLines(innerW);
    const viewportHeight = this.viewportHeight();
    const maxScroll = Math.max(0, contentLines.length - viewportHeight);
    if (this.autoScroll) this.scrollOffset = maxScroll;
    const visibleStart = Math.min(this.scrollOffset, maxScroll);
    const visible = contentLines.slice(visibleStart, visibleStart + viewportHeight);
    for (let i = 0; i < viewportHeight; i++) lines.push(row(visible[i] ?? ""));

    lines.push(hrMid);
    const scrollPct =
      contentLines.length <= viewportHeight
        ? "100%"
        : `${Math.round(((visibleStart + viewportHeight) / contentLines.length) * 100)}%`;
    const footerLeft = th.fg("dim", `${contentLines.length} lines · ${scrollPct}`);
    const footerRight = th.fg("dim", "↑↓ scroll · PgUp/PgDn · Esc close");
    const footerGap = Math.max(1, innerW - visibleWidth(footerLeft) - visibleWidth(footerRight));
    lines.push(row(footerLeft + " ".repeat(footerGap) + footerRight));
    lines.push(hrBot);

    return lines;
  }

  // fallow-ignore-next-line unused-class-member
  invalidate(): void {
    /* no cached state to clear */
  }

  // fallow-ignore-next-line unused-class-member
  dispose(): void {
    this.closed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  // ---- Private ----

  private innerWidth(): number {
    return Math.max(0, this.tui.terminal.columns - 4);
  }

  private viewportHeight(): number {
    const maxRows = Math.floor((this.tui.terminal.rows * VIEWPORT_HEIGHT_PCT) / 100);
    return Math.max(MIN_VIEWPORT, maxRows - CHROME_LINES);
  }

  private buildContentLines(innerW: number): string[] {
    if (innerW <= 0) return [];
    const wrapped: string[] = [];
    for (const line of renderTranscriptLines(this.source)) {
      if (line === "") {
        wrapped.push("");
        continue;
      }
      wrapped.push(...this.wrapText(line, innerW));
    }
    return wrapped.map((l) => truncateToWidth(l, innerW));
  }
}
