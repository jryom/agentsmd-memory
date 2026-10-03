# Changelog

## 1.6.0 — 2026-10-03

- Keep Node.js 18+ runtime compatibility. Development and CI use the LTS version in `.tool-versions`.
- Save fewer notes: consider related facts together at task completion and skip routine discoveries and duplicates.
- Add `memory_review` for cleaning up existing notes.
- Report word counts with a configurable soft budget (`MEMORY_MAX_WORDS`, default 1,000).
- Respect Git boundaries when finding memory files and allow `cwd` to select a project within MCP roots.
- Fix protocol version negotiation, ping, malformed input handling, asynchronous tool results, and stale workspace roots.
- Check npm package contents and keep npm, Codex, and Claude plugin versions aligned.
