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

test("MEMORY_NUDGE overrides the injected text", async () => {
  const prev = process.env.MEMORY_NUDGE
  try {
    process.env.MEMORY_NUDGE = "custom reminder"
    const hooks = await AgentsmdMemoryPlugin()
    const output = { system: [] }
    await hooks["experimental.chat.system.transform"]({}, output)
    assert.deepEqual(output.system, ["custom reminder"])
  } finally {
    if (prev === undefined) delete process.env.MEMORY_NUDGE
    else process.env.MEMORY_NUDGE = prev
  }
})

test("empty MEMORY_NUDGE falls back to the default text", async () => {
  const prev = process.env.MEMORY_NUDGE
  try {
    process.env.MEMORY_NUDGE = "   "
    const hooks = await AgentsmdMemoryPlugin()
    const output = { system: ["base"] }
    await hooks["experimental.chat.system.transform"]({}, output)
    assert.equal(output.system.length, 2)
    assert.match(output.system[1], /memory_save/)
  } finally {
    if (prev === undefined) delete process.env.MEMORY_NUDGE
    else process.env.MEMORY_NUDGE = prev
  }
})
