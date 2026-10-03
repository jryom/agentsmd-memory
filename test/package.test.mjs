import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("npm package includes server, shared policy, and complete plugin integrations", () => {
  const cli = process.env.npm_execpath
  const command = cli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm")
  const args = [...(cli ? [cli] : []), "pack", "--dry-run", "--ignore-scripts", "--json"]
  const packed = JSON.parse(execFileSync(command, args, {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    shell: !cli && process.platform === "win32",
  }))
  const pkg = Array.isArray(packed) ? packed[0] : (packed.files ? packed : Object.values(packed)[0])
  assert.ok(Array.isArray(pkg.files), "npm pack must return a package file listing")
  const files = new Set(pkg.files.map((file) => file.path))
  for (const path of [
    "package.json", "README.md", "CHANGELOG.md", "LICENSE",
    "docs/clients.md", "docs/development.md",
    "src/index.mjs", "src/server.mjs", "src/tools.mjs", "src/resolve.mjs", "src/policy.mjs", "src/plugin.mjs",
    "hooks/hooks.json", "hooks/nudge.mjs", ".mcp.json",
    ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json",
  ]) assert.ok(files.has(path), `missing packaged file: ${path}`)
  assert.equal(pkg.files.some((file) => file.path.startsWith("test/")), false)
  assert.equal(pkg.files.some((file) => file.path.startsWith(".github/")), false)
})
