# @gotgenes/pi-session-tools

[![npm version](https://img.shields.io/npm/v/@gotgenes/pi-session-tools?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@gotgenes/pi-session-tools) [![CI](https://img.shields.io/github/actions/workflow/status/gotgenes/pi-packages/ci.yml?style=flat&logo=github&label=CI)](https://github.com/gotgenes/pi-packages/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![pnpm](https://img.shields.io/badge/pnpm-%3E%3D11-F69220?style=flat&logo=pnpm&logoColor=white)](https://pnpm.io/) [![Pi Package](https://img.shields.io/badge/Pi-Package-6366F1?style=flat)](https://pi.mariozechner.at/)

Pi extension providing session metadata tools for multi-session workflows.

## Tools

### `set_session_name`

Set the current session's display name (shown in the session selector).

```text
set_session_name({ name: "#42 Planning — Extract ExtensionPaths" })
```

Use a stage-encoded format to identify both the issue and workflow stage:

| Stage         | Format                       |
| ------------- | ---------------------------- |
| Planning      | `#N Planning — <title>`      |
| TDD           | `#N TDD — <title>`           |
| Build         | `#N Build — <title>`         |
| Retrospective | `#N Retrospective — <title>` |

### `get_session_name`

Get the current session's display name, if one has been set.

```text
get_session_name({})
```

### `read_session`

Read the current session's entries as a structured transcript.
Useful for retro lenses and cross-session context.

```text
read_session({ types?: string[], limit?: number })
```

Parameters:

- `types` — filter to specific entry types (e.g. `["message", "compaction"]`).
  Omit for all.
- `limit` — return only the most recent N entries after filtering.

The output is a human-readable transcript: numbered user/assistant turns, one-line tool call summaries with correlated result status, and metadata events (compaction, model changes).
Tool result bodies, thinking content, and image data are omitted.

In the TUI the tool row shows a compact summary by default (e.g. `✓ 42 entries — 38 messages, 18 tool calls, 2 compactions`).
Press `Ctrl-O` to expand to the full transcript.
The model always receives the full transcript regardless of the TUI state.

```text
1. user
How do I fix the login bug?

---

2. assistant [anthropic/claude-sonnet-4-20250514]
Let me check the auth flow.
  [tool] Read — path: src/auth/login.ts → completed
  [tool] Bash — command: pnpm vitest login → error
The test is failing because...

---

[compaction] Context compacted (48000 tokens before)

---

[model change] → anthropic/claude-opus-4-20250514
```

### `read_parent_session`

Read the parent session's entries as a structured transcript when running inside a subagent.
Derives the parent session file from the subagent directory layout.
Returns an error if not running in a subagent context.

```text
read_parent_session({ types?: string[], limit?: number })
```

Parameters and output format are the same as `read_session`.

## Install

```bash
pi install npm:@gotgenes/pi-session-tools
```

Or add it to your Pi settings (`.pi/settings.json`):

```json
{
  "packages": ["npm:@gotgenes/pi-session-tools"]
}
```

## License

MIT
