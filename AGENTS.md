# agentsmd-memory

Zero-dependency MCP server exposing `memory_save`/`memory_forget`. Tools never write files; they return merge instructions the agent applies itself. Ships an opencode plugin and a Claude Code plugin, both injecting a per-turn nudge (shared `resolveNudge` in `src/plugin.mjs`, overridable via `MEMORY_NUDGE`).

## Resolution

- File resolution (unset `MEMORY_FILE`) prefers `AGENTS.md`, falls back to `CLAUDE.md`; nearest-up wins, `AGENTS.md` beats `CLAUDE.md` at the same level, and `AGENTS.md` is created when nothing exists. `MEMORY_FILE` set = single explicit name, no fallback.
- `memoryFileNames()` returns the ordered candidate list; `memoryFileName()` kept as `[0]` for back-compat. `resolveMemoryFile` accepts a name or an array.

## Gotchas

- Claude Code auto-discovers `hooks/hooks.json`; do NOT list it under `hooks` in `.claude-plugin/plugin.json` — causes a "Duplicate hooks file" load failure.
- `marketplace.json` rejects a `$schema` key and wants the description under `metadata.description` (not top-level).
