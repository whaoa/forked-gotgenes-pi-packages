/**
 * agent-config-editor.ts — Agent detail view with edit/delete/eject/disable/enable transitions.
 *
 * Extracted from agent-menu.ts to give each concern a single responsibility.
 * Receives dependencies via injection — no direct `node:fs` imports.
 */

import { join } from "node:path";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentTypeRegistry } from "../agent-types.js";
import type { AgentConfig } from "../types.js";
import type { AgentFileOps } from "./agent-file-ops.js";

// ---- Deps interface ----

export interface AgentConfigEditorDeps {
  fileOps: AgentFileOps;
  registry: AgentTypeRegistry;
  personalAgentsDir: string;
  projectAgentsDir: string;
}

// ---- Factory ----

export function createAgentConfigEditor(deps: AgentConfigEditorDeps) {
  function agentDirs(): string[] {
    return [deps.projectAgentsDir, deps.personalAgentsDir];
  }

  async function showAgentDetail(ctx: ExtensionContext, name: string) {
    if (deps.registry.resolveType(name) == null) {
      ctx.ui.notify(`Agent config not found for "${name}".`, "warning");
      return;
    }
    const cfg = deps.registry.resolveAgentConfig(name);

    const file = deps.fileOps.findAgentFile(name, agentDirs());
    const isDefault = cfg.isDefault === true;
    const disabled = cfg.enabled === false;

    let menuOptions: string[];
    if (disabled && file) {
      menuOptions = isDefault
        ? ["Enable", "Edit", "Reset to default", "Delete", "Back"]
        : ["Enable", "Edit", "Delete", "Back"];
    } else if (isDefault && !file) {
      menuOptions = ["Eject (export as .md)", "Disable", "Back"];
    } else if (isDefault && file) {
      menuOptions = ["Edit", "Disable", "Reset to default", "Delete", "Back"];
    } else {
      menuOptions = ["Edit", "Disable", "Delete", "Back"];
    }

    const choice = await ctx.ui.select(name, menuOptions);
    if (!choice || choice === "Back") return;

    if (choice === "Edit" && file) {
      const content = deps.fileOps.read(file);
      if (content !== undefined) {
        const edited = await ctx.ui.editor(`Edit ${name}`, content);
        if (edited !== undefined && edited !== content) {
          deps.fileOps.write(file, edited);
          deps.registry.reload();
          ctx.ui.notify(`Updated ${file}`, "info");
        }
      }
    } else if (choice === "Delete") {
      if (file) {
        const confirmed = await ctx.ui.confirm(
          "Delete agent",
          `Delete ${name} (${file})?`,
        );
        if (confirmed) {
          deps.fileOps.remove(file);
          deps.registry.reload();
          ctx.ui.notify(`Deleted ${file}`, "info");
        }
      }
    } else if (choice === "Reset to default" && file) {
      const confirmed = await ctx.ui.confirm(
        "Reset to default",
        `Delete override ${file} and restore embedded default?`,
      );
      if (confirmed) {
        deps.fileOps.remove(file);
        deps.registry.reload();
        ctx.ui.notify(`Restored default ${name}`, "info");
      }
    } else if (choice.startsWith("Eject")) {
      await ejectAgent(ctx, name, cfg);
    } else if (choice === "Disable") {
      await disableAgent(ctx, name);
    } else if (choice === "Enable") {
      await enableAgent(ctx, name);
    }
  }

  async function ejectAgent(ctx: ExtensionContext, name: string, cfg: AgentConfig) {
    const location = await ctx.ui.select("Choose location", [
      "Project (.pi/agents/)",
      `Personal (${deps.personalAgentsDir})`,
    ]);
    if (!location) return;

    const targetDir = location.startsWith("Project")
      ? deps.projectAgentsDir
      : deps.personalAgentsDir;

    const targetPath = join(targetDir, `${name}.md`);
    if (deps.fileOps.exists(targetPath)) {
      const overwrite = await ctx.ui.confirm(
        "Overwrite",
        `${targetPath} already exists. Overwrite?`,
      );
      if (!overwrite) return;
    }

    const fmFields: string[] = [];
    fmFields.push(`description: ${cfg.description}`);
    if (cfg.displayName) fmFields.push(`display_name: ${cfg.displayName}`);
    fmFields.push(`tools: ${cfg.builtinToolNames?.join(", ") || "all"}`);
    if (cfg.model) fmFields.push(`model: ${cfg.model}`);
    if (cfg.thinking) fmFields.push(`thinking: ${cfg.thinking}`);
    if (cfg.maxTurns) fmFields.push(`max_turns: ${cfg.maxTurns}`);
    fmFields.push(`prompt_mode: ${cfg.promptMode}`);
    if (cfg.extensions === false) fmFields.push("extensions: false");
    else if (Array.isArray(cfg.extensions))
      fmFields.push(`extensions: ${cfg.extensions.join(", ")}`);
    if (cfg.skills === false) fmFields.push("skills: false");
    else if (Array.isArray(cfg.skills))
      fmFields.push(`skills: ${cfg.skills.join(", ")}`);
    if (cfg.disallowedTools?.length)
      fmFields.push(`disallowed_tools: ${cfg.disallowedTools.join(", ")}`);
    if (cfg.inheritContext) fmFields.push("inherit_context: true");
    if (cfg.runInBackground) fmFields.push("run_in_background: true");
    if (cfg.isolated) fmFields.push("isolated: true");
    if (cfg.memory) fmFields.push(`memory: ${cfg.memory}`);
    if (cfg.isolation) fmFields.push(`isolation: ${cfg.isolation}`);

    const content = `---\n${fmFields.join("\n")}\n---\n\n${cfg.systemPrompt}\n`;

    deps.fileOps.write(targetPath, content);
    deps.registry.reload();
    ctx.ui.notify(`Ejected ${name} to ${targetPath}`, "info");
  }

  async function disableAgent(ctx: ExtensionContext, name: string) {
    const file = deps.fileOps.findAgentFile(name, agentDirs());
    if (file) {
      const content = deps.fileOps.read(file);
      if (content?.includes("\nenabled: false\n")) {
        ctx.ui.notify(`${name} is already disabled.`, "info");
        return;
      }
      if (content) {
        const updated = content.replace(/^---\n/, "---\nenabled: false\n");
        deps.fileOps.write(file, updated);
        deps.registry.reload();
        ctx.ui.notify(`Disabled ${name} (${file})`, "info");
      }
      return;
    }

    const location = await ctx.ui.select("Choose location", [
      "Project (.pi/agents/)",
      `Personal (${deps.personalAgentsDir})`,
    ]);
    if (!location) return;

    const targetDir = location.startsWith("Project")
      ? deps.projectAgentsDir
      : deps.personalAgentsDir;

    const targetPath = join(targetDir, `${name}.md`);
    deps.fileOps.write(targetPath, "---\nenabled: false\n---\n");
    deps.registry.reload();
    ctx.ui.notify(`Disabled ${name} (${targetPath})`, "info");
  }

  async function enableAgent(ctx: ExtensionContext, name: string) {
    const file = deps.fileOps.findAgentFile(name, agentDirs());
    if (!file) return;

    const content = deps.fileOps.read(file);
    if (!content) return;

    const updated = content.replace(/^(---\n)enabled: false\n/, "$1");

    if (updated.trim() === "---\n---" || updated.trim() === "---\n---\n") {
      deps.fileOps.remove(file);
      deps.registry.reload();
      ctx.ui.notify(`Enabled ${name} (removed ${file})`, "info");
    } else {
      deps.fileOps.write(file, updated);
      deps.registry.reload();
      ctx.ui.notify(`Enabled ${name} (${file})`, "info");
    }
  }

  return { showAgentDetail };
}
