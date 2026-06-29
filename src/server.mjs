// Bidirectional JSON-RPC 2.0 peer. Unlike most stdio MCP servers it also
// initiates a request (roots/list) to learn the client's workspace dir, so it
// must correlate its own request ids with incoming responses.

import { tools as defaultTools } from "./tools.mjs"

export const PROTOCOL_VERSION = "2024-11-05"
const ROOTS_TIMEOUT_MS = 2000

export function createServer({ send, tools = defaultTools, version = "0.0.0" } = {}) {
  let supportsRoots = false
  let roots = null // null = unfetched; array = fetched
  let rootsPromise = null
  let nextId = 1
  const pending = new Map()

  const reply = (id, result) => send({ jsonrpc: "2.0", id, result })
  const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } })

  function request(method, params) {
    return new Promise((resolve) => {
      const id = `srv-${nextId++}`
      const timer = setTimeout(() => pending.delete(id) && resolve(null), ROOTS_TIMEOUT_MS)
      timer.unref?.()
      pending.set(id, { resolve, timer })
      send({ jsonrpc: "2.0", id, method, params })
    })
  }

  function ensureRoots() {
    if (roots !== null) return Promise.resolve(roots)
    if (!supportsRoots) return Promise.resolve((roots = []))
    return (rootsPromise ??= request("roots/list", {}).then((res) => {
      rootsPromise = null
      return (roots = (res && Array.isArray(res.roots) && res.roots) || [])
    }))
  }

  async function handleMessage(msg) {
    if (!msg || typeof msg !== "object") return
    const { id, method, params } = msg

    if (method === undefined && pending.has(id)) {
      const { resolve, timer } = pending.get(id)
      clearTimeout(timer)
      pending.delete(id)
      resolve("error" in msg ? null : msg.result)
      return
    }

    if (method === "initialize") {
      supportsRoots = Boolean(params?.capabilities?.roots)
      return reply(id, {
        protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "agentsmd-memory", version },
      })
    }

    if (method?.startsWith("notifications/")) {
      if (method === "notifications/initialized") ensureRoots()
      else if (method === "notifications/roots/list_changed") (roots = null), (rootsPromise = null)
      return
    }

    if (method === "tools/list") {
      return reply(id, {
        tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      })
    }

    if (method === "tools/call") {
      const tool = tools.find((t) => t.name === params?.name)
      if (!tool) return fail(id, -32602, `Unknown tool: ${params?.name}`)
      try {
        reply(id, tool.run(params?.arguments ?? {}, { roots: await ensureRoots() }))
      } catch (err) {
        reply(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true })
      }
      return
    }

    if (id !== undefined) fail(id, -32601, `Method not found: ${method}`)
  }

  return { handleMessage }
}
