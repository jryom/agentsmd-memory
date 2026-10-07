import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, writeFileSync, readFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { execFile, execFileSync } from "node:child_process"
import { promisify } from "node:util"
import { project } from "./helpers.mjs"
import { lifecycle, rankFacts, changeFact, recordFeedback, factRevision } from "../src/lifecycle.mjs"
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

test("read and legacy tools do not edit either store", (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("migration")])
  const before = readFileSync(join(cwd, ".agents-memory.json"), "utf8")
  for (const [name, args] of [
    ["memory_save", { learning: "migration gotcha" }],
    ["memory_forget", { description: "migration gotcha" }],
    ["memory_review", {}],
    ["memory_recall", { query: "migration" }],
  ]) {
    const result = call(name, cwd, args)
    assert.equal(result.isError, false)
    if (["memory_review", "memory_recall"].includes(name)) {
      assert.match(result.content[0].text, /\.agents-memory/)
      assert.match(result.content[0].text, /untrusted data/)
    } else assert.match(result.content[0].text, /AGENTS\.md/)
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
  const bound = factRevision(fact("migration"))
  const memory = { facts: [fact("migration")], signals: [
    { id: "migration", task: "one", outcome: "useful", at: now, factRevision: bound },
    { id: "migration", task: "one", outcome: "useful", at: now, factRevision: bound },
    { id: "migration", task: "two", outcome: "contradicted", at: now + 1, factRevision: bound },
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

test("future telemetry cannot overpower lexical relevance", () => {
  const entry = fact("future")
  const memory = { facts: [entry], signals: [{ id: entry.id, task: "future", outcome: "useful", at: Number.MAX_SAFE_INTEGER, factRevision: factRevision(entry) }] }
  assert.equal(rankFacts(memory, "unrelatedtopic", 1800000000000).length, 0)
  assert.equal(rankFacts(memory, "migration", 1800000000000)[0].score, 12)
})

test("invalid stores and duplicate ids fail closed", (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("same"), fact("same")])
  assert.throws(() => lifecycle({ cwd }, {}), /Duplicate fact id/)
  writeStore(cwd, [fact("ok")])
  writeFileSync(join(cwd, ".agents-memory.local.json"), '{"version":1,"signals":[{}]}')
  assert.throws(() => lifecycle({ cwd }, {}))
})

test("sidecar symlinks including dangling links are rejected", (t) => {
  for (const name of [".agents-memory.json", ".agents-memory.local.json"]) {
    const cwd = project(t)
    if (name.includes("local")) writeStore(cwd, [fact("ok")])
    symlinkSync(join(cwd, "missing"), join(cwd, name))
    assert.throws(() => lifecycle({ cwd }, {}), /non-symlink/)
  }
})

test("feedback rejects invalid inputs and unknown facts", async (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("ok"), fact("old", { status: "archived" })])
  for (const args of [{}, { id: "ok", task: "t", outcome: "seen" }, { id: "missing", task: "t", outcome: "useful" }, { id: "old", task: "t", outcome: "useful" }]) {
    await assert.rejects(call("memory_feedback", cwd, { verification: "Checked current docs", ...args }))
  }
})

const revision = (cwd) => lifecycle({ cwd }, {}).revision
const change = (cwd, args) => changeFact({ cwd, expectedRevision: revision(cwd), verification: "Checked current migration docs", ...args }, {})
const feedback = (cwd, args) => recordFeedback({ cwd, id: "ok", task: "task-1", outcome: "useful", verification: "Verified migration API prevented direct edits", ...args }, {})
function ignoredProject(t) {
  const cwd = project(t)
  execFileSync("git", ["init", "--quiet", cwd])
  writeFileSync(join(cwd, ".gitignore"), ".agents-memory.local.json\n.agents-memory.json.lock/\n")
  writeStore(cwd, [fact("ok")])
  return cwd
}

test("explicit operations add candidates, promote, correct, and archive", async (t) => {
  const cwd = project(t)
  writeStore(cwd, [])
  await change(cwd, { action: "add", id: "new", fact: "Use supported API", scope: "migration", reason: "Avoid corruption", evidence: ["docs/migrations.md"] })
  assert.equal(lifecycle({ cwd }, {}).facts[0].status, "candidate")
  await change(cwd, { action: "promote", id: "new", evidence: ["docs/migrations.md#api"] })
  assert.equal(lifecycle({ cwd }, {}).facts[0].status, "active")
  await change(cwd, { action: "correct", id: "new", fact: "Use migration API v2", evidence: ["docs/migrations.md#v2"] })
  const result = await change(cwd, { action: "archive", id: "new", verification: "Migration tool removed; docs now prohibit its use" })
  assert.equal(result.fact.status, "archived")
  assert.match(result.fact.archiveReason, /removed/)
  assert.equal(result.fact.lastChange.action, "archive")
  assert.equal(rankFacts(lifecycle({ cwd }, {}), "migration").length, 0)
  assert.equal(existsSync(join(cwd, ".agents-memory.json.lock")), false)
})

test("protected operations require approval and cannot bypass through promotion", async (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("safe", { protected: true, status: "candidate" })])
  for (const args of [
    { action: "archive" },
    { action: "correct", fact: "Unsafe instruction", evidence: ["docs/changed.md"], protected: false },
    { action: "promote", fact: "Unsafe instruction", evidence: ["docs/changed.md"] },
  ]) await assert.rejects(change(cwd, { id: "safe", ...args }), /userApproval|cannot change/)
  await change(cwd, { action: "archive", id: "safe", userApproval: "User explicitly approved retiring this obsolete safety rule" })
  const stored = lifecycle({ cwd }, {}).facts[0]
  assert.equal(stored.protected, true)
  assert.match(stored.lastChange.userApproval, /explicitly approved/)
})

test("stale revisions reject changes without overwriting user edits", async (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("ok")])
  const expectedRevision = revision(cwd)
  await change(cwd, { action: "correct", id: "ok", fact: "User's new fact", evidence: ["docs/new.md"] })
  await assert.rejects(change(cwd, { action: "archive", id: "ok", expectedRevision }), /revision changed/)
  assert.equal(lifecycle({ cwd }, {}).facts[0].fact, "User's new fact")
})

test("feedback writes ignored telemetry atomically, deduplicating task votes", async (t) => {
  const cwd = ignoredProject(t)
  const before = readFileSync(join(cwd, ".agents-memory.json"), "utf8")
  await feedback(cwd)
  await feedback(cwd, { outcome: "contradicted" })
  const memory = lifecycle({ cwd }, {})
  assert.equal(memory.signals.length, 1)
  assert.equal(memory.signals[0].outcome, "contradicted")
  assert.equal(readFileSync(memory.path, "utf8"), before)
  assert.equal(execFileSync("git", ["status", "--porcelain", "--", ".agents-memory.local.json"], { cwd, encoding: "utf8" }), "")
})

test("feedback refuses unignored or tracked telemetry", async (t) => {
  const cwd = ignoredProject(t)
  writeFileSync(join(cwd, ".gitignore"), "")
  await assert.rejects(feedback(cwd), /Git-ignored/)
  assert.equal(existsSync(join(cwd, ".agents-memory.local.json")), false)
  writeFileSync(join(cwd, ".agents-memory.local.json"), '{"version":1,"signals":[]}')
  execFileSync("git", ["add", ".agents-memory.local.json"], { cwd })
  writeFileSync(join(cwd, ".gitignore"), ".agents-memory.local.json\n")
  await assert.rejects(feedback(cwd), /Git-ignored/)
})

test("concurrent feedback preserves every distinct task", async (t) => {
  const cwd = ignoredProject(t)
  await Promise.all(Array.from({ length: 5 }, (_, i) => feedback(cwd, { task: `task-${i}` })))
  assert.equal(lifecycle({ cwd }, {}).signals.length, 5)
})

test("concurrent tracked edits allow only one writer per revision", async (t) => {
  const cwd = project(t)
  writeStore(cwd, [fact("ok")])
  const expectedRevision = revision(cwd)
  const results = await Promise.allSettled([
    change(cwd, { action: "correct", id: "ok", fact: "First fact", evidence: ["docs/one.md"], expectedRevision }),
    change(cwd, { action: "correct", id: "ok", fact: "Second fact", evidence: ["docs/two.md"], expectedRevision }),
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(results.filter((result) => result.status === "rejected").length, 1)
})

test("new tools expose JSON schemas derived from runtime Zod schemas", () => {
  const tool = tools.find((tool) => tool.name === "memory_fact")
  assert.ok(tool.inputSchema.required.includes("expectedRevision"))
  assert.ok(tool.inputSchema.required.includes("verification"))
  assert.deepEqual(tool.inputSchema.properties.action.enum, ["add", "promote", "correct", "archive"])
})

test("corrections invalidate old usefulness and contradiction signals", async (t) => {
  const cwd = ignoredProject(t)
  await feedback(cwd, { outcome: "contradicted" })
  assert.equal(rankFacts(lifecycle({ cwd }, {}), "migration")[0].contradicted, true)
  await change(cwd, { action: "correct", id: "ok", fact: "Use migration API v2", evidence: ["docs/v2.md"] })
  assert.equal(rankFacts(lifecycle({ cwd }, {}), "migration")[0].contradicted, false)
  assert.equal(lifecycle({ cwd }, {}).signals.length, 1)
})

test("independent processes serialize local feedback writes", async (t) => {
  const cwd = ignoredProject(t)
  const module = new URL("../src/lifecycle.mjs", import.meta.url).href
  const run = promisify(execFile)
  await Promise.all(Array.from({ length: 4 }, (_, i) => run(process.execPath, ["--input-type=module", "-e", `
    import { recordFeedback } from ${JSON.stringify(module)};
    await recordFeedback(${JSON.stringify({ cwd, id: "ok", task: `process-${i}`, outcome: "useful", verification: "Checked current docs" })}, {});
  `])))
  assert.equal(lifecycle({ cwd }, {}).signals.length, 4)
})
