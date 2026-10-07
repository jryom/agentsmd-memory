import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { createServer, PROTOCOL_VERSION } from "../src/server.mjs"
import { project } from "./helpers.mjs"

// Build a server whose outbound messages land in `outbox`, with a helper to
// drive inbound messages.
function harness() {
  const outbox = []
  const server = createServer({ send: (m) => outbox.push(m), version: "1.2.3" })
  const feed = (m) => server.handleMessage(m)
  const last = () => outbox[outbox.length - 1]
  const find = (pred) => outbox.find(pred)
  return { outbox, feed, last, find, server }
}

test("initialize accepts a supported protocol version and returns server info", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } })
  const res = h.last()
  assert.equal(res.id, 1)
  assert.equal(res.result.protocolVersion, "2025-06-18")
  assert.equal(res.result.serverInfo.name, "agentsmd-memory")
  assert.equal(res.result.serverInfo.version, "1.2.3")
  assert.deepEqual(res.result.capabilities, { tools: {} })
})

test("failed roots discovery blocks tools until roots are refreshed", async (t) => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: { roots: {} } } })
  await h.feed({ jsonrpc: "2.0", method: "notifications/initialized" })
  const req = h.find((msg) => msg.method === "roots/list")
  await h.feed({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: "failed" } })
  await h.feed({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "memory_review" } })
  assert.equal(h.last().result.isError, true)
  assert.match(h.last().result.content[0].text, /Workspace discovery failed/)
  await h.feed({ jsonrpc: "2.0", method: "notifications/roots/list_changed" })
  const call = h.feed({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "memory_review" } })
  const latest = h.outbox.filter((msg) => msg.method === "roots/list").at(-1)
  await h.feed({ jsonrpc: "2.0", id: latest.id, result: { roots: [{ uri: pathToFileURL(project(t)).href }] } })
  await call
  assert.equal(h.last().result.isError, false)
})

test("initialize negotiates a supported version instead of echoing unknown versions", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2099-01-01" } })
  assert.equal(h.last().result.protocolVersion, PROTOCOL_VERSION)
  await h.feed({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2024-11-05" } })
  assert.equal(h.last().result.protocolVersion, "2024-11-05")
})

test("ping returns an empty result", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "ping" })
  assert.deepEqual(h.last().result, {})
})

test("late or unknown responses never receive a response", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: "srv-99", result: { roots: [] } })
  await h.feed({ jsonrpc: "2.0", id: "srv-98", error: { code: -32601, message: "Not found" } })
  assert.equal(h.outbox.length, 0)
})

test("malformed envelopes and tool arguments receive errors", async () => {
  const h = harness()
  for (const msg of [null, [], { id: 1, method: "ping" }, { jsonrpc: "2.0", id: 1, method: 42 }]) {
    await h.feed(msg)
    assert.equal(h.last().error.code, -32600)
  }
  for (const args of [null, "wrong", []]) {
    await h.feed({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "memory_save", arguments: args } })
    assert.equal(h.last().error.code, -32602)
  }
})

test("tool results await asynchronous implementations", async () => {
  const outbox = []
  const server = createServer({
    send: (msg) => outbox.push(msg),
    tools: [{ name: "async", run: async () => ({ content: [{ type: "text", text: "done" }] }) }],
  })
  await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "async" } })
  assert.equal(outbox[0].result.content[0].text, "done")
})

test("roots changed during a pending fetch cannot restore stale workspace roots", async () => {
  const oldDir = mkdtempSync(join(tmpdir(), "agentsmd-old-"))
  const newDir = mkdtempSync(join(tmpdir(), "agentsmd-new-"))
  try {
    mkdirSync(join(oldDir, ".git"))
    mkdirSync(join(newDir, ".git"))
    const h = harness()
    await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: { roots: { listChanged: true } } } })
    await h.feed({ jsonrpc: "2.0", method: "notifications/initialized" })
    const oldRequest = h.find((msg) => msg.method === "roots/list")
    await h.feed({ jsonrpc: "2.0", method: "notifications/roots/list_changed" })
    const call = h.feed({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "memory_save", arguments: { learning: "candidate" } } })
    const newRequest = h.outbox.filter((msg) => msg.method === "roots/list").at(-1)
    assert.notEqual(oldRequest.id, newRequest.id)
    await h.feed({ jsonrpc: "2.0", id: oldRequest.id, result: { roots: [{ uri: pathToFileURL(oldDir).href }] } })
    await h.feed({ jsonrpc: "2.0", id: newRequest.id, result: { roots: [{ uri: pathToFileURL(newDir).href }] } })
    await call
    assert.ok(h.find((msg) => msg.id === 9).result.content[0].text.includes(join(newDir, "AGENTS.md")))
  } finally {
    rmSync(oldDir, { recursive: true, force: true })
    rmSync(newDir, { recursive: true, force: true })
  }
})

test("initialize falls back to default protocol version", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: {} } })
  assert.equal(h.last().result.protocolVersion, PROTOCOL_VERSION)
})

test("tools/list returns all tools with schemas", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  const names = h.last().result.tools.map((t) => t.name).sort()
  assert.deepEqual(names, ["memory_fact", "memory_feedback", "memory_forget", "memory_recall", "memory_review", "memory_save"])
  for (const t of h.last().result.tools) {
    assert.equal(t.inputSchema.type, "object")
  }
})

test("unknown method returns -32601", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 3, method: "does/not/exist" })
  assert.equal(h.last().error.code, -32601)
})

test("unknown tool returns -32602", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope", arguments: {} } })
  assert.equal(h.last().error.code, -32602)
})

test("notifications get no response", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", method: "notifications/initialized" })
  // The only outbound message allowed here is a server-initiated roots/list
  // request (when client declared the capability). With no capability declared,
  // there must be zero outbound messages.
  assert.equal(h.outbox.length, 0)
})

test("invalid ids are rejected and request methods without ids receive no reply", async () => {
  const h = harness()
  for (const id of [null, {}, [], true, Infinity]) {
    await h.feed({ jsonrpc: "2.0", id, method: "ping" })
    assert.equal(h.last().error.code, -32600)
    assert.equal(h.last().id, null)
  }
  h.outbox.length = 0
  for (const method of ["initialize", "ping", "tools/list", "tools/call"]) {
    await h.feed({ jsonrpc: "2.0", method })
  }
  assert.equal(h.outbox.length, 0)
})

test("malformed params receive errors, not silently swallowed failures", async () => {
  const h = harness()
  for (const params of [null, [], "wrong", 42]) {
    await h.feed({ jsonrpc: "2.0", id: 1, method: "tools/call", params })
    assert.equal(h.last().error.code, -32602)
  }
})

test("invalid cwd returns an actionable tool error", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "memory_save", arguments: { learning: "candidate", cwd: "/no/such/project" },
  } })
  assert.equal(h.last().result.isError, true)
  assert.match(h.last().result.content[0].text, /cwd must be an absolute path/)
})

test("invalid MEMORY_FILE returns an actionable tool error", async () => {
  const previous = process.env.MEMORY_FILE
  try {
    process.env.MEMORY_FILE = "../../etc/passwd"
    const h = harness()
    await h.feed({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "memory_review", arguments: {},
    } })
    assert.equal(h.last().result.isError, true)
    assert.match(h.last().result.content[0].text, /MEMORY_FILE must be a single file name/)
  } finally {
    if (previous === undefined) delete process.env.MEMORY_FILE
    else process.env.MEMORY_FILE = previous
  }
})

test("does not request roots when client lacks the capability", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: {} } })
  h.outbox.length = 0
  await h.feed({ jsonrpc: "2.0", method: "notifications/initialized" })
  assert.equal(h.find((m) => m.method === "roots/list"), undefined)
})

test("full roots round-trip drives tool resolution to the root workspace", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "agentsmd-proto-"))
  try {
    mkdirSync(join(rootDir, ".git"))
    const h = harness()
    await h.feed({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { capabilities: { roots: { listChanged: true } } },
    })
    await h.feed({ jsonrpc: "2.0", method: "notifications/initialized" })

    // Server should have emitted a roots/list request.
    const req = h.find((m) => m.method === "roots/list")
    assert.ok(req, "expected a roots/list request")

    // Respond as the client would.
    await h.feed({ jsonrpc: "2.0", id: req.id, result: { roots: [{ uri: pathToFileURL(rootDir).href }] } })

    // Now a tool call (no cwd arg) must resolve to the root workspace.
    await h.feed({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "memory_save", arguments: { learning: "fact from roots" } },
    })
    const callRes = h.find((m) => m.id === 9)
    assert.equal(callRes.result.isError, false)
    const text = callRes.result.content[0].text
    assert.match(text, new RegExp(join(rootDir, "AGENTS.md").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})
