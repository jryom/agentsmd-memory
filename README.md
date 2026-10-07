# agentsmd-memory

[![npm](https://img.shields.io/npm/v/agentsmd-memory)](https://www.npmjs.com/package/agentsmd-memory)
[![ci](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml/badge.svg)](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/agentsmd-memory)](./LICENSE)

MCP server for project notes in `AGENTS.md`. No dependencies. Requires Node.js 24+.

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

Plugin supports OpenCode V2 and V1 1.18.29+. Configuration below is for V2; [V1 configuration](docs/clients.md#opencode-v1).

```sh
opencode plugin add github:jryom/agentsmd-memory
```

Or add the GitHub package reference to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:jryom/agentsmd-memory"]
}
```

Restart opencode after editing. [Setup for Cursor, Claude Desktop, and Copilot](docs/clients.md).

V2 plugin provides native memory tools and the reminder; no separate MCP server is needed. Remove an existing memory MCP entry to avoid duplicate tools. Native tools require an explicit absolute `cwd` on every call, avoiding reliance on the plugin instance's directory when sessions move. Other clients and V1 continue to use MCP.

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

For MCP clients, set file and budget options in the server environment. For native OpenCode V2 tools, set them in the OpenCode process environment. Set the reminder override in the client environment. Disable the plugin hook to stop reminders.

By default, resolution checks `AGENTS.md`, then `CLAUDE.md`, at each directory up to the nearest Git root. The nearest file wins, including a nearer `CLAUDE.md`. Without Git, the search reaches the filesystem root. If no file exists, the tool proposes a file at the Git root or starting directory; the agent can skip creating it.

Pass an absolute `cwd` to select a project within an advertised MCP root. Invalid paths and paths outside advertised roots return errors. With multiple distinct roots, `cwd` is required; with one root it is optional. Without roots, selection uses `cwd` or the server's working directory. Symlinks are resolved before checking containment. Invalid path-like `MEMORY_FILE` values return errors rather than being shortened to a file name.

## Development

Node.js LTS is pinned in `.tool-versions`. Use `asdf install`, `mise install`, or install that version directly.

```sh
npm test
npx @modelcontextprotocol/inspector node src/index.mjs
```

[Local testing and releases](docs/development.md). [Changelog](CHANGELOG.md).

## License

MIT
