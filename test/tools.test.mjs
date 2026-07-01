import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { tools } from "../src/tools.mjs"

const save = tools.find((t) => t.name === "memory_save")
const forget = tools.find((t) => t.name === "memory_forget")

function tmp() {
  return mkdtempSync(join(tmpdir(), "agentsmd-"))
}

test("memory_save returns create instructions for a new file, no write", () => {
  const dir = tmp()
  try {
    mkdirSync(join(dir, ".git"))
    const res = save.run({ learning: "uses pnpm not npm", cwd: dir }, {})
    assert.equal(res.isError, false)
    const file = join(dir, "AGENTS.md")
    assert.ok(!existsSync(file)) // not written; agent creates it
    assert.match(res.content[0].text, /Create one at/)
    assert.match(res.content[0].text, /uses pnpm not npm/)
    assert.match(res.content[0].text, /Write tool/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("memory_save on existing file returns merge instructions, no write", () => {
  const dir = tmp()
  try {
    const file = join(dir, "AGENTS.md")
    const before = "# proj\n\n## Notes\n- existing fact\n"
    writeFileSync(file, before)
    const res = save.run({ learning: "deploy via 'make ship'", cwd: dir }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /Integrate this fact into/)
    assert.match(res.content[0].text, /deploy via 'make ship'/)
    assert.equal(readFileSync(file, "utf8"), before) // untouched
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("memory_save rejects empty learning", () => {
  const res = save.run({ learning: "  " }, {})
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /non-empty/)
})

test("memory_save uses roots from ctx over cwd", () => {
  const rootDir = tmp()
  try {
    mkdirSync(join(rootDir, ".git"))
    const res = save.run(
      { learning: "fact" },
      { roots: [{ uri: "file://" + rootDir }] },
    )
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, new RegExp(join(rootDir, "AGENTS.md").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

test("memory_forget returns instructions when file exists", () => {
  const dir = tmp()
  try {
    writeFileSync(join(dir, "AGENTS.md"), "# proj\n- stale fact\n")
    const res = forget.run({ description: "stale fact", cwd: dir }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /remove any facts matching/)
    assert.match(res.content[0].text, /stale fact/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("memory_forget reports nothing when no file exists", () => {
  const dir = tmp()
  try {
    const res = forget.run({ description: "anything", cwd: dir }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /nothing to forget/)
    assert.match(res.content[0].text, /AGENTS\.md or CLAUDE\.md/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("memory_forget falls back to CLAUDE.md when AGENTS.md is absent", () => {
  const dir = tmp()
  try {
    writeFileSync(join(dir, "CLAUDE.md"), "# claude\n- stale fact\n")
    const res = forget.run({ description: "stale fact", cwd: dir }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /CLAUDE\.md/)
    assert.match(res.content[0].text, /remove any facts matching/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("memory_save integrates into an existing CLAUDE.md when no AGENTS.md", () => {
  const dir = tmp()
  try {
    const file = join(dir, "CLAUDE.md")
    const before = "# proj\n\n## Notes\n- existing\n"
    writeFileSync(file, before)
    const res = save.run({ learning: "prefers pnpm", cwd: dir }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /Integrate this fact into/)
    assert.match(res.content[0].text, /CLAUDE\.md/)
    assert.equal(readFileSync(file, "utf8"), before) // untouched
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("memory_forget rejects empty description", () => {
  const res = forget.run({ description: "" }, {})
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /non-empty/)
})

test("MEMORY_FILE override targets a different file", () => {
  const dir = tmp()
  const prev = process.env.MEMORY_FILE
  try {
    mkdirSync(join(dir, ".git"))
    process.env.MEMORY_FILE = "CLAUDE.md"
    const res = save.run({ learning: "claude-only fact", cwd: dir }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /CLAUDE\.md/)
    assert.doesNotMatch(res.content[0].text, /AGENTS\.md/)
  } finally {
    if (prev === undefined) delete process.env.MEMORY_FILE
    else process.env.MEMORY_FILE = prev
    rmSync(dir, { recursive: true, force: true })
  }
})
