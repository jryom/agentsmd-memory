import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { pathToFileURL } from "node:url"
import { project } from "./helpers.mjs"

test("stdio server reports malformed JSON and continues serving requests", () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL("../src/index.mjs", import.meta.url))], {
    input: 'broken JSON\n{"jsonrpc":"2.0","id":7,"method":"ping"}\n',
    encoding: "utf8",
  }).trim().split("\n").map((line) => JSON.parse(line))
  assert.equal(output[0].error.code, -32700)
  assert.equal(output[0].id, null)
  assert.deepEqual(output[1], { jsonrpc: "2.0", id: 7, result: {} })
})

for (const mode of ["success", "error", "timeout"]) {
  test(`stdio workspace discovery: ${mode}`, { timeout: 6000 }, async (t) => {
    const directory = project(t)
    const child = spawn(process.execPath, [fileURLToPath(new URL("../src/index.mjs", import.meta.url))])
    t.after(() => child.kill())
    const messages = []
    const send = (message) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n")
    const result = new Promise((resolve, reject) => {
      child.on("error", reject)
      createInterface({ input: child.stdout }).on("line", (line) => {
        const msg = JSON.parse(line)
        messages.push(msg)
        if (msg.method === "roots/list" && mode !== "timeout") {
          send(mode === "success"
            ? { id: msg.id, result: { roots: [{ uri: pathToFileURL(directory).href }] } }
            : { id: msg.id, error: { code: -32603, message: "failed" } })
        }
        if (msg.id === 2) resolve(msg.result)
      })
    })
    send({ id: 1, method: "initialize", params: { capabilities: { roots: {} } } })
    send({ method: "notifications/initialized" })
    send({ id: 2, method: "tools/call", params: { name: "memory_save", arguments: { learning: "candidate" } } })
    const response = await result
    assert.equal(response.isError, mode !== "success")
    assert.match(response.content[0].text, mode === "success" ? /candidate/ : /Workspace discovery failed/)
    assert.equal(messages.filter((msg) => msg.method === "roots/list").length, 1)
    const exited = once(child, "exit")
    child.stdin.end()
    await exited
  })
}
