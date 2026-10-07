# Changelog

## 1.7.0 — 2026-10-07

- Keep workspace-discovery failures separate from empty roots and block unsafe fallback until roots refresh.
- Provide native OpenCode V2 tools without a separate MCP process; require explicit project selection.
- Share reminder policy independently of client adapters, deduplicate tool guidance, and add isolated fixtures and stdio discovery tests.
- Synchronize plugin manifest versions through the npm version hook.
- Reject invalid or out-of-workspace `cwd` values; require explicit project selection with multiple workspace roots and check symlink containment.
- Reject path-like `MEMORY_FILE` values instead of silently shortening them.
- Support OpenCode V2 reminders through a shared V1/V2 entrypoint; V1 reminder support now requires OpenCode 1.18.29+.
- Tighten JSON-RPC IDs and parameters, suppress replies to notifications, and report unexpected server failures instead of swallowing them.
- Require Node.js 24+ and keep CI on the pinned Node.js 24 runtime.
- Add repeatable manual memory-quality evaluations.

## 1.6.0 — 2026-10-03

- Save fewer notes: consider related facts together at task completion and skip routine discoveries and duplicates.
- Add `memory_review` for cleaning up existing notes.
- Report word counts with a configurable soft budget (`MEMORY_MAX_WORDS`, default 1,000).
- Respect Git boundaries when finding memory files and allow `cwd` to select a project within MCP roots.
- Fix protocol version negotiation, ping, malformed input handling, asynchronous tool results, and stale workspace roots.
- Check npm package contents and keep npm, Codex, and Claude plugin versions aligned.
