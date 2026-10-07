import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { project } from "./helpers.mjs"
import { syncVersion } from "../scripts/sync-version.mjs"

test("release helper synchronizes versions and preserves manifest metadata", (t) => {
  const directory = project(t)
  writeFileSync(join(directory, "package.json"), JSON.stringify({ version: "2.0.0" }))
  for (const client of [".claude-plugin", ".codex-plugin"]) {
    mkdirSync(join(directory, client))
    writeFileSync(join(directory, client, "plugin.json"), JSON.stringify({ name: "memory", version: "1.0.0" }))
  }
  syncVersion(directory)
  for (const client of [".claude-plugin", ".codex-plugin"]) {
    assert.deepEqual(JSON.parse(readFileSync(join(directory, client, "plugin.json"))), { name: "memory", version: "2.0.0" })
  }
})
