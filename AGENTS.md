# agentsmd-memory

Zero-dependency MCP server exposing `memory_save`/`memory_forget`/`memory_review`. Tools never write files; they return instructions the agent applies itself. Ships opencode, Claude Code, and Codex integrations, all sharing `src/policy.mjs` through `resolveNudge` in `src/plugin.mjs` (overridable via `MEMORY_NUDGE`).

## Policy

- Admission is deliberately conservative: batch only mistake-preventing or costly-to-rediscover facts at task completion; cleanup is explicit, and soft budgets never override essential instructions.
- Keep docs short and plain; README covers common setup, with secondary client examples and release procedures in linked docs.

## Resolution

- File resolution (unset `MEMORY_FILE`) prefers `AGENTS.md`, falls back to `CLAUDE.md`; nearest-up wins within the git boundary, `AGENTS.md` beats `CLAUDE.md` at the same level, and `AGENTS.md` is proposed when nothing exists. `MEMORY_FILE` set = single explicit name, no fallback.
- `memoryFileNames()` returns the ordered candidate list; `memoryFileName()` kept as `[0]` for back-compat. `resolveMemoryFile` accepts a name or an array.

## Gotchas

- Use Node.js LTS pinned in `.tool-versions` for development, checks, and publishing; user prefers this over nvm. Runtime compatibility remains Node.js 18+; a development runtime update alone must not raise the package engine floor.
- Claude Code auto-discovers `hooks/hooks.json`; do NOT list it under `hooks` in `.claude-plugin/plugin.json` — causes a "Duplicate hooks file" load failure.
- Codex also auto-discovers `hooks/hooks.json`; keep the shared hook command as one string. Codex ignores Claude-style separate `args` in hook handlers.
- Claude Code and Codex share `.mcp.json`, which launches unpinned
  `npx -y agentsmd-memory`. This intentionally follows npm's `latest` tag;
  plugin-root variables are hook-only in Codex and cannot portably locate the
  bundled MCP source across both clients.
- Local plugin installation therefore mixes local hooks with published npm tools; use a temporary MCP configuration pointing to local `src/index.mjs` to test pending server changes.
- `marketplace.json` rejects a `$schema` key and wants the description under `metadata.description` (not top-level).
