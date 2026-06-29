# agentsmd-memory

[![npm](https://img.shields.io/npm/v/agentsmd-memory)](https://www.npmjs.com/package/agentsmd-memory)
[![ci](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml/badge.svg)](https://github.com/jryom/agentsmd-memory/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/agentsmd-memory)](./LICENSE)

MCP server for keeping project memory in `AGENTS.md`. Zero dependencies.

The tools don't edit files. They resolve the nearest `AGENTS.md` and return merge instructions; the agent applies them with its own edit tools, so changes show up as a git diff.

## Tools

- `memory_save` — record a durable fact (decision, convention, gotcha, non-obvious command).
- `memory_forget` — remove a stale fact.

## Install

Published on npm as [`agentsmd-memory`](https://www.npmjs.com/package/agentsmd-memory). Runs via `npx` — no global install needed. Add to your MCP client's config:

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

opencode uses `mcp` with `"type": "local"`; Claude Code: `claude mcp add --transport stdio memory -- npx -y agentsmd-memory`. Windows: wrap as `cmd /c npx -y agentsmd-memory`.

### opencode plugin (recommended)

The tools are prompt-driven — the agent only calls them if it decides to, which rarely happens mid-task. The package also ships an opencode plugin that injects a short reminder into the system prompt every turn, so the agent reliably reaches for `memory_save`/`memory_forget`. Enable it alongside the MCP server:

```json
{
  "plugin": ["agentsmd-memory"]
}
```

## Config

| Env | Default | Purpose |
| --- | --- | --- |
| `MEMORY_FILE` | `AGENTS.md` | Target file name, e.g. `CLAUDE.md`, `GEMINI.md`. Bare name only. |

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
