import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

function json(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
}

test("Codex manifest matches package and Claude plugin versions", () => {
  const pkg = json("../package.json")
  const codex = json("../.codex-plugin/plugin.json")
  const claude = json("../.claude-plugin/plugin.json")

  assert.equal(codex.name, pkg.name)
  assert.equal(codex.version, pkg.version)
  assert.equal(claude.version, pkg.version)
  assert.equal(codex.mcpServers, "./.mcp.json")
})

test("shared MCP server launches bundled source through plugin root", () => {
  const config = json("../.mcp.json")
  const server = config.mcpServers.memory

  assert.equal(server.command, "node")
  assert.deepEqual(server.args, ["${CLAUDE_PLUGIN_ROOT}/src/index.mjs"])
})
