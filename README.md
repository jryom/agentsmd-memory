# agentsmd-memory

[![npm](https://img.shields.io/npm/v/agentsmd-memory)](https://www.npmjs.com/package/agentsmd-memory)
[![ci](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml/badge.svg)](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/agentsmd-memory)](./LICENSE)

MCP server for keeping project memory in `AGENTS.md`. Zero dependencies.

The tools don't edit files. They resolve the nearest memory file and return instructions the agent carries out with its own Write/Edit tools, so every change — even creating the file — shows up as a reviewable git diff.

## Tools

- `memory_save` — record a durable fact (decision, convention, gotcha, non-obvious command).
- `memory_forget` — remove a stale fact.

## Install

Published on npm as [`agentsmd-memory`](https://www.npmjs.com/package/agentsmd-memory). Runs via `npx` — no global install needed. The config schema differs per client; pick yours below. On Windows, wrap the command as `cmd /c npx -y agentsmd-memory`.

### Claude Code

```sh
claude mcp add --transport stdio memory -- npx -y agentsmd-memory
```

### Claude Desktop / Cursor

`claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "agentsmd-memory"]
    }
  }
}
```

### opencode

`~/.config/opencode/opencode.json`. Note the differences: top-level `mcp` (not `mcpServers`), `command` is a single **array**, env goes in `environment` (not `env`).

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "memory": {
      "type": "local",
      "command": ["npx", "-y", "agentsmd-memory"],
      "enabled": true
    }
  },
  "plugin": ["agentsmd-memory"]
}
```

The `plugin` line is recommended — see [opencode plugin](#opencode-plugin-recommended). It loads from npm by name, so it requires `agentsmd-memory >= 1.2.0`; restart opencode after editing.

### GitHub Copilot — VS Code

`.vscode/mcp.json` (project) or your user `mcp.json`. Top-level key is `servers` and the type is `stdio`:

```json
{
  "servers": {
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "agentsmd-memory"]
    }
  }
}
```

### GitHub Copilot — CLI

```sh
copilot mcp add memory -- npx -y agentsmd-memory
```

Or edit `~/.copilot/mcp-config.json` directly. Copilot CLI requires `type: "local"` and a `tools` field:

```json
{
  "mcpServers": {
    "memory": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "agentsmd-memory"],
      "tools": ["*"]
    }
  }
}
```

### GitHub Copilot — coding agent (repo settings)

Repo → **Settings → Copilot → MCP servers**. Same shape as the CLI (`type: "local"`, `tools` required). Any env vars must be prefixed `COPILOT_MCP_`.

```json
{
  "mcpServers": {
    "memory": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "agentsmd-memory"],
      "tools": ["*"]
    }
  }
}
```

### opencode plugin (recommended)

The tools are prompt-driven — the agent only calls them if it decides to, which rarely happens mid-task. The package also ships an opencode plugin that injects a short reminder into the system prompt every turn, so the agent reliably reaches for `memory_save`/`memory_forget`. It's enabled via the `"plugin": ["agentsmd-memory"]` line in the [opencode](#opencode) config above. Override the reminder text with the `MEMORY_NUDGE` env var.

## Config

| Env | Default | Purpose |
| --- | --- | --- |
| `MEMORY_FILE` | `AGENTS.md` | Target file name, e.g. `CLAUDE.md`, `GEMINI.md`. Bare name only. |
| `MEMORY_NUDGE` | built-in reminder | opencode plugin only. Overrides the per-turn reminder text. To skip injection, don't load the plugin. |

## Notes

- Workspace dir is resolved from MCP roots, else a `cwd` arg, else `process.cwd()`. From there it walks up to the git root; nearest existing file wins.
- The tools never write files. When no memory file exists, `memory_save` returns instructions to create one; the agent authors it with its own Write tool, so even bootstrapping shows up as a reviewable diff.
- Saves are prompt-driven; the agent decides when to call them. The bundled [opencode plugin](#opencode-plugin-recommended) nudges it every turn.

## Develop

```sh
npm test
npx @modelcontextprotocol/inspector npx -y agentsmd-memory
```

Source: [github.com/jryom/agentsmd-memory](https://github.com/jryom/agentsmd-memory).

## License

MIT
