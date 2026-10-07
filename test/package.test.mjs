import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { project } from "./helpers.mjs"

function packageResult(output) {
  const packed = JSON.parse(output)
  return Array.isArray(packed) ? packed[0] : (packed.files ? packed : Object.values(packed)[0])
}

test("npm package includes server, shared policy, and complete plugin integrations", () => {
  const cli = process.env.npm_execpath
  const command = cli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm")
  const args = [...(cli ? [cli] : []), "pack", "--dry-run", "--ignore-scripts", "--json"]
  const pkg = packageResult(execFileSync(command, args, {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    shell: !cli && process.platform === "win32",
  }))
  assert.ok(Array.isArray(pkg.files), "npm pack must return a package file listing")
  const files = new Set(pkg.files.map((file) => file.path))
  for (const path of [
    "package.json", "README.md", "CHANGELOG.md", "LICENSE",
    "docs/clients.md", "docs/development.md", "docs/evaluation.md", "scripts/sync-version.mjs",
     "src/index.mjs", "src/server.mjs", "src/tools.mjs", "src/resolve.mjs", "src/policy.mjs", "src/plugin.mjs", "src/lifecycle.mjs", "src/schemas.mjs",
    "hooks/hooks.json", "hooks/nudge.mjs", ".mcp.json",
    ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json",
  ]) assert.ok(files.has(path), `missing packaged file: ${path}`)
  assert.equal(pkg.files.some((file) => file.path.startsWith("test/")), false)
  assert.equal(pkg.files.some((file) => file.path.startsWith(".github/")), false)
  assert.equal(files.has("AGENTS.md"), false)
})

test("packed package installs offline and serves stdio requests", (t) => {
  const directory = project(t)
  const cli = process.env.npm_execpath
  const command = cli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm")
  const npm = (args) => execFileSync(command, [...(cli ? [cli] : []), ...args], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8",
    shell: !cli && process.platform === "win32",
  })
  const packed = packageResult(npm(["pack", "--ignore-scripts", "--json", "--pack-destination", directory]))
  npm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", directory, join(directory, packed.filename)])
  const output = execFileSync(process.execPath, [join(directory, "node_modules/agentsmd-memory/src/index.mjs")], {
    input: '{"jsonrpc":"2.0","id":1,"method":"ping"}\n', encoding: "utf8",
  })
  assert.deepEqual(JSON.parse(output), { jsonrpc: "2.0", id: 1, result: {} })
})
