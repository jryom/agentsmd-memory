import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, writeFileSync, readFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { project } from "./helpers.mjs"
import { lifecycle, rankFacts } from "../src/lifecycle.mjs"
import { tools } from "../src/tools.mjs"

const fact = (id, extra = {}) => ({ id, fact: "Migration must use supported API", scope: "database migration", evidence: ["docs/migrations.md"], reason: "Direct edits corrupt state", status: "active", protected: false, ...extra })
const writeStore = (cwd, facts) => writeFileSync(join(cwd, ".agents-memory.json"), JSON.stringify({ version: 1, facts }))
const call = (name, cwd, args = {}) => tools.find((tool) => tool.name === name).run({ cwd, ...args }, {})

test("lifecycle is opt-in and never creates files", (t) => {
  const cwd = project(t)
  assert.equal(lifecycle({ cwd }, {}), null)
  assert.match(call("memory_recall", cwd, { query: "migration" }).content[0].text, /not enabled/)
  assert.equal(existsSync(join(cwd, ".agents-memory.json")), false)
})

test("lifecycle tools return reviewable instructions without editing stores", (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("migration")])
  const before = readFileSync(join(cwd, ".agents-memory.json"), "utf8")
  for (const [name, args] of [
    ["memory_save", { learning: "migration gotcha" }],
    ["memory_forget", { description: "migration gotcha" }],
    ["memory_review", {}],
    ["memory_recall", { query: "migration" }],
    ["memory_feedback", { id: "migration", task: "task-1", outcome: "useful" }],
  ]) {
    const result = call(name, cwd, args)
    assert.equal(result.isError, false)
    assert.match(result.content[0].text, /\.agents-memory/)
    assert.match(result.content[0].text, /untrusted data/)
  }
  assert.equal(readFileSync(join(cwd, ".agents-memory.json"), "utf8"), before)
  assert.equal(existsSync(join(cwd, ".agents-memory.local.json")), false)
})

test("retrieval excludes archives, unrelated facts, and caps results", () => {
  const facts = Array.from({ length: 8 }, (_, i) => fact(`migration-${i}`))
  facts.push(fact("archive", { status: "archived" }), fact("other", { fact: "Use turquoise", scope: "design", reason: "Visual consistency", evidence: [] }))
  const selected = rankFacts({ facts, signals: [] }, "database migration")
  assert.equal(selected.length, 5)
  assert.ok(selected.every((entry) => entry.id.startsWith("migration-") && entry.needsVerification))
  assert.equal(rankFacts({ facts, signals: [] }, "unrelatedtopic").length, 0)
})

test("distinct tasks reinforce; freshness decays; contradictions remain visible", () => {
  const now = 1800000000000
  const memory = { facts: [fact("migration")], signals: [
    { id: "migration", task: "one", outcome: "useful", at: now },
    { id: "migration", task: "one", outcome: "useful", at: now },
    { id: "migration", task: "two", outcome: "contradicted", at: now + 1 },
  ] }
  const recent = rankFacts(memory, "migration", now)[0]
  assert.equal(recent.score, 12)
  assert.equal(recent.contradicted, true)
  assert.equal(rankFacts(memory, "migration", now + 91 * 86400000)[0].score, 11)
  assert.equal(memory.facts[0].status, "active")
})

test("protected rare facts are retained, not automatically expired", () => {
  const memory = { facts: [fact("recovery", { protected: true })], signals: [] }
  assert.equal(rankFacts(memory, "migration", Number.MAX_SAFE_INTEGER)[0].protected, true)
  assert.equal(memory.facts[0].status, "active")
})

test("invalid stores and duplicate ids fail closed", (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("same"), fact("same")])
  assert.throws(() => lifecycle({ cwd }, {}), /duplicate id/)
  writeStore(cwd, [fact("ok")])
  writeFileSync(join(cwd, ".agents-memory.local.json"), '{"version":1,"signals":[{}]}')
  assert.throws(() => lifecycle({ cwd }, {}), /Invalid local/)
})

test("sidecar symlinks including dangling links are rejected", (t) => {
  for (const name of [".agents-memory.json", ".agents-memory.local.json"]) {
    const cwd = project(t)
    if (name.includes("local")) writeStore(cwd, [fact("ok")])
    symlinkSync(join(cwd, "missing"), join(cwd, name))
    assert.throws(() => lifecycle({ cwd }, {}), /non-symlink/)
  }
})

test("feedback rejects invalid inputs and unknown facts", (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("ok"), fact("old", { status: "archived" })])
  for (const args of [{}, { id: "ok", task: "t", outcome: "seen" }, { id: "missing", task: "t", outcome: "useful" }, { id: "old", task: "t", outcome: "useful" }]) {
    assert.equal(call("memory_feedback", cwd, args).isError, true)
  }
})
