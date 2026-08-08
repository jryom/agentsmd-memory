import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

function json(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
}

const pluginRoot = fileURLToPath(new URL("..", import.meta.url))

function launchWith(variable) {
  const server = json("../.mcp.json").mcpServers.memory
  const args = server.args.map((arg) =>
    arg === variable ? pluginRoot : arg,
  )
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { capabilities: {} },
  })
  return JSON.parse(
    execFileSync(server.command, args, { input: `${request}\n`, encoding: "utf8" }),
  )
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

test("shared MCP server accepts both Codex and Claude plugin roots", () => {
  const config = json("../.mcp.json")
  const server = config.mcpServers.memory

  assert.equal(server.command, "node")
  assert.equal(server.args[0], "-e")
  assert.match(server.args[1], /src.*index\.mjs/)
  assert.deepEqual(server.args.slice(2), [
    "${PLUGIN_ROOT}",
    "${CLAUDE_PLUGIN_ROOT}",
  ])
})

test("shared MCP launcher starts through Codex PLUGIN_ROOT", () => {
  const response = launchWith("${PLUGIN_ROOT}")
  assert.equal(response.result.serverInfo.name, "agentsmd-memory")
})

test("shared MCP launcher starts through Claude CLAUDE_PLUGIN_ROOT", () => {
  const response = launchWith("${CLAUDE_PLUGIN_ROOT}")
  assert.equal(response.result.serverInfo.name, "agentsmd-memory")
})
