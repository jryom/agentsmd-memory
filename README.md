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

## Config

| Env | Default | Purpose |
| --- | --- | --- |
| `MEMORY_FILE` | `AGENTS.md` | Target file name, e.g. `CLAUDE.md`, `GEMINI.md`. Bare name only. |

## Notes

- Workspace dir is resolved from MCP roots, else a `cwd` arg, else `process.cwd()`. From there it walks up to the git root; nearest existing file wins.
- The only direct write is bootstrapping a missing file on first `memory_save`. Everything else is instruction-only.
- Saves are prompt-driven; the agent decides when to call them.

## Develop

```sh
npm test
npx @modelcontextprotocol/inspector npx -y agentsmd-memory
```

Source: [github.com/jryom/agentsmd-memory](https://github.com/jryom/agentsmd-memory).

## License

MIT
