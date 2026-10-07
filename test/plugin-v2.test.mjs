import { test } from "node:test"
import assert from "node:assert/strict"
import plugin, { DEFAULT_NUDGE } from "../src/plugin.mjs"
import { project } from "./helpers.mjs"
import { existsSync } from "node:fs"
import { join } from "node:path"

test("V2 registers only an agent-context hook and preserves existing context", async (t) => {
  const hooks = new Map()
  const definitions = []
  await plugin.setup({
    session: { async hook(name, callback) { hooks.set(name, callback) } },
    tool: { async transform(callback) { callback({ namespace() {}, add(tool) { definitions.push(tool) } }) } },
  })
  assert.deepEqual(definitions.map((tool) => tool.name), ["memory_save", "memory_forget", "memory_review"])
  const directory = project(t)
  for (const tool of definitions) assert.ok(tool.input.required.includes("cwd"))
  const save = definitions[0]
  await assert.rejects(save.execute({ learning: "candidate" }), /absolute cwd/)
  await assert.rejects(save.execute({ learning: "", cwd: directory }), /non-empty/)
  const result = await save.execute({ learning: "candidate", cwd: directory })
  assert.match(result.content, /candidate/)
  assert.equal(existsSync(join(directory, "AGENTS.md")), false)
  const movedDirectory = project(t)
  const movedResult = await save.execute({ learning: "candidate", cwd: movedDirectory })
  assert.ok(movedResult.content.includes(movedDirectory))
  assert.ok(!movedResult.content.includes(directory))
  assert.deepEqual([...hooks.keys()], ["context"])
  const base = { type: "text", text: "base instructions" }
  const event = { system: [base], messages: [], tools: {} }
  hooks.get("context")(event)
  assert.deepEqual(event.system, [base, { type: "text", text: DEFAULT_NUDGE }])
  assert.deepEqual(event.messages, [])
  assert.deepEqual(event.tools, {})
  const previous = process.env.MEMORY_NUDGE
  try {
    process.env.MEMORY_NUDGE = "custom reminder"
    const next = { system: [] }
    hooks.get("context")(next)
    assert.deepEqual(next.system, [{ type: "text", text: "custom reminder" }])
  } finally {
    if (previous === undefined) delete process.env.MEMORY_NUDGE
    else process.env.MEMORY_NUDGE = previous
  }
})
