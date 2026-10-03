# agentsmd-memory

[![npm](https://img.shields.io/npm/v/agentsmd-memory)](https://www.npmjs.com/package/agentsmd-memory)
[![ci](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml/badge.svg)](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/agentsmd-memory)](./LICENSE)

MCP server for project notes in `AGENTS.md`. No dependencies. Requires Node.js 18+.

Tools return a file path and editing instructions. The agent makes the edits with its own tools, so changes appear in your Git diff.

## Install

### Codex

```sh
codex plugin marketplace add https://github.com/jryom/agentsmd-memory.git
codex plugin add agentsmd-memory@agentsmd-memory
```

Restart Codex, then review and trust the plugin hook with `/hooks`.

### Claude Code

```sh
claude plugin marketplace add jryom/agentsmd-memory
claude plugin install agentsmd-memory@agentsmd-memory
```

Both plugins install the MCP tools and a reminder hook. Node.js must already be installed.

### opencode

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

Restart opencode after editing. [Setup for Cursor, Claude Desktop, and Copilot](docs/clients.md).

## Tools

| Tool | Purpose |
| --- | --- |
| `memory_save` | Assess and merge a fact or small batch of related facts |
| `memory_forget` | Correct or remove outdated guidance |
| `memory_review` | Clean up existing notes when requested or after a major change |

The reminder asks the agent to consider saves at task completion. Most tasks should leave memory unchanged. Save decisions and gotchas that prevent future mistakes or expensive rediscovery; skip task summaries, duplicates, and facts already clear from code or docs.

For example, keep the reason a migration must use an API instead of direct database edits. Skip a note that `npm test` runs tests.

Saves report the file's word count against a soft budget. The budget does not truncate files or override essential instructions. The agent still decides what to keep. Existing project rules that demand saving every discovery need updating too.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `MEMORY_FILE` | unset | Use one file name, such as `GEMINI.md`, instead of the default candidates |
| `MEMORY_MAX_WORDS` | `1000` | Soft file budget in whitespace-delimited words; positive integer |
| `MEMORY_NUDGE` | built-in reminder | Replace the plugin reminder; tool guidance still applies |

Set file and budget options in the MCP server environment. Set the reminder override in the client environment. Disable the plugin hook to stop reminders.

By default, resolution checks `AGENTS.md`, then `CLAUDE.md`, at each directory up to the nearest Git root. The nearest file wins, including a nearer `CLAUDE.md`. Without Git, the search reaches the filesystem root. If no file exists, the tool proposes a file at the Git root or starting directory; the agent can skip creating it.

Pass an absolute `cwd` to select a project within an advertised MCP root. Otherwise, selection uses the first valid root, then a valid `cwd`, then the server's working directory.

## Development

Node.js LTS is pinned in `.tool-versions`. Use `asdf install`, `mise install`, or install that version directly.

```sh
npm test
npx @modelcontextprotocol/inspector node src/index.mjs
```

[Local testing and releases](docs/development.md). [Changelog](CHANGELOG.md).

## License

MIT
