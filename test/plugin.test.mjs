import { test } from "node:test"
import assert from "node:assert/strict"
import AgentsmdMemoryPlugin, { AgentsmdMemoryPlugin as named } from "../src/plugin.mjs"

test("plugin exports the same factory as default and named", () => {
  assert.equal(AgentsmdMemoryPlugin, named)
  assert.equal(typeof AgentsmdMemoryPlugin, "function")
})

test("system.transform hook pushes a nudge onto output.system", async () => {
  const hooks = await AgentsmdMemoryPlugin()
  const transform = hooks["experimental.chat.system.transform"]
  const output = { system: ["base prompt"] }
  await transform({}, output)
  assert.equal(output.system.length, 2)
  assert.match(output.system[1], /memory_save/)
  assert.match(output.system[1], /memory_forget/)
})

test("system.transform is a no-op when output.system is absent", async () => {
  const hooks = await AgentsmdMemoryPlugin()
  const transform = hooks["experimental.chat.system.transform"]
  await transform({}, {}) // must not throw
  await transform({}, undefined)
})
