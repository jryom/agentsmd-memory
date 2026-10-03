import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { memoryMaxWords, DEFAULT_MAX_WORDS } from "../src/policy.mjs"
import { tools } from "../src/tools.mjs"

test("soft budget accepts positive safe integers and defaults for invalid input", () => {
  assert.equal(memoryMaxWords({ MEMORY_MAX_WORDS: " 250 " }), 250)
  for (const value of [undefined, 250, "", "0", "-5", "1.5", "Infinity", "500words", "1e3", "9007199254740992"]) {
    assert.equal(memoryMaxWords({ MEMORY_MAX_WORDS: value }), DEFAULT_MAX_WORDS)
  }
})

test("save reports existing size and discourages growth without writing", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentsmd-budget-"))
  const previous = process.env.MEMORY_MAX_WORDS
  try {
    mkdirSync(join(dir, ".git"))
    const file = join(dir, "AGENTS.md")
    const content = "# Project\n\nKeep permission rules.\n"
    writeFileSync(file, content)
    process.env.MEMORY_MAX_WORDS = "3"
    const res = tools.find((t) => t.name === "memory_save").run({ cwd: dir, learning: "A candidate" }, {})
    assert.equal(res.isError, false)
    assert.match(res.content[0].text, /5 whitespace-delimited words; soft budget: 3 words/)
    assert.match(res.content[0].text, /File exceeds the soft budget/)
    assert.match(res.content[0].text, /Skip task summaries/)
    assert.match(res.content[0].text, /do not.*unsolicited full-file cleanup/)
    assert.equal(readFileSync(file, "utf8"), content)
  } finally {
    if (previous === undefined) delete process.env.MEMORY_MAX_WORDS
    else process.env.MEMORY_MAX_WORDS = previous
    rmSync(dir, { recursive: true, force: true })
  }
})

test("review preserves essential guidance and never creates or changes files", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentsmd-review-"))
  try {
    mkdirSync(join(dir, ".git"))
    const tool = tools.find((t) => t.name === "memory_review")
    const file = join(dir, "AGENTS.md")
    const missing = tool.run({ cwd: dir }, {})
    assert.match(missing.content[0].text, /nothing to review/)
    assert.equal(existsSync(file), false)
    writeFileSync(file, "# Project\n")
    const existing = tool.run({ cwd: dir }, {})
    assert.match(existing.content[0].text, /Review/)
    assert.match(existing.content[0].text, /Preserve user instructions, safety rules/)
    assert.match(existing.content[0].text, /leave it unchanged/)
    assert.equal(readFileSync(file, "utf8"), "# Project\n")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
