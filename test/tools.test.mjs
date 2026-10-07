import { test } from "node:test"
import assert from "node:assert/strict"
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tools } from "../src/tools.mjs"
import { project } from "./helpers.mjs"

const save = tools.find((tool) => tool.name === "memory_save")
const forget = tools.find((tool) => tool.name === "memory_forget")

test("save proposes a new file without creating it", (t) => {
  const cwd = project(t)
  const result = save.run({ learning: "candidate", cwd }, {})
  assert.equal(result.isError, false)
  assert.match(result.content[0].text, /creating one at/)
  assert.match(result.content[0].text, /Otherwise, leave files unchanged/)
  assert.match(result.content[0].text, /candidate/)
  assert.equal(existsSync(join(cwd, "AGENTS.md")), false)
})

for (const name of ["AGENTS.md", "CLAUDE.md"]) {
  test(`save and forget resolve ${name} without changing it`, (t) => {
    const cwd = project(t)
    const path = join(cwd, name)
    const before = "# Project\n- existing fact\n"
    writeFileSync(path, before)
    for (const [tool, args] of [[save, { learning: "candidate" }], [forget, { description: "existing fact" }]]) {
      const result = tool.run({ ...args, cwd }, {})
      assert.equal(result.isError, false)
      assert.ok(result.content[0].text.includes(path))
      assert.equal(readFileSync(path, "utf8"), before)
    }
  })
}

test("save and forget reject empty candidates", () => {
  for (const [tool, args] of [[save, { learning: "  " }], [forget, { description: "" }]]) {
    const result = tool.run(args, {})
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, /non-empty/)
  }
})

test("save selects the advertised workspace", (t) => {
  const cwd = project(t)
  const result = save.run({ learning: "candidate" }, { roots: [{ uri: "file://" + cwd }] })
  assert.equal(result.isError, false)
  assert.ok(result.content[0].text.includes(join(cwd, "AGENTS.md")))
})

test("forget reports missing memory without creating it", (t) => {
  const cwd = project(t)
  const result = forget.run({ description: "anything", cwd }, {})
  assert.equal(result.isError, false)
  assert.match(result.content[0].text, /AGENTS\.md or CLAUDE\.md/)
  assert.match(result.content[0].text, /nothing to forget/)
  assert.equal(existsSync(join(cwd, "AGENTS.md")), false)
})

test("MEMORY_FILE selects an explicit filename", (t) => {
  const cwd = project(t)
  const previous = process.env.MEMORY_FILE
  t.after(() => {
    if (previous === undefined) delete process.env.MEMORY_FILE
    else process.env.MEMORY_FILE = previous
  })
  process.env.MEMORY_FILE = "CLAUDE.md"
  const result = save.run({ learning: "candidate", cwd }, {})
  assert.equal(result.isError, false)
  assert.ok(result.content[0].text.includes(join(cwd, "CLAUDE.md")))
  assert.doesNotMatch(result.content[0].text, /AGENTS\.md/)
})
