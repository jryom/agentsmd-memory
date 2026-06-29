import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { createServer, PROTOCOL_VERSION } from "../src/server.mjs"

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

test("initialize echoes requested protocol version and server info", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } })
  const res = h.last()
  assert.equal(res.id, 1)
  assert.equal(res.result.protocolVersion, "2025-06-18")
  assert.equal(res.result.serverInfo.name, "agentsmd-memory")
  assert.equal(res.result.serverInfo.version, "1.2.3")
  assert.deepEqual(res.result.capabilities, { tools: {} })
})

test("initialize falls back to default protocol version", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: {} } })
  assert.equal(h.last().result.protocolVersion, PROTOCOL_VERSION)
})

test("tools/list returns both tools with schemas", async () => {
  const h = harness()
  await h.feed({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  const names = h.last().result.tools.map((t) => t.name).sort()
  assert.deepEqual(names, ["memory_forget", "memory_save"])
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
    assert.ok(existsSync(join(rootDir, "AGENTS.md")))
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})
