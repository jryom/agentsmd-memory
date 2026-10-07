# Other clients

Node.js 24+ must be available on the client's execution path. On Windows, use `cmd /c npx -y agentsmd-memory`.

## opencode V1

Requires OpenCode 1.18.29+ for the plugin's shared V1/V2 object entrypoint. Older V1 clients can still use the MCP server without the plugin reminder.

In `~/.config/opencode/opencode.json`:

```json
{
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

<details>
<summary><b>Claude Code — MCP only</b></summary>

Tools without the nudge:

```sh
claude mcp add --transport stdio memory -- npx -y agentsmd-memory
```

</details>

<details>
<summary><b>Claude Desktop / Cursor</b></summary>

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

</details>

<details>
<summary><b>GitHub Copilot — VS Code</b></summary>

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

</details>

<details>
<summary><b>GitHub Copilot — CLI</b></summary>

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

</details>

<details>
<summary><b>GitHub Copilot — coding agent (repo settings)</b></summary>

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

</details>
