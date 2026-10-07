import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { pathToFileURL } from "node:url"
import { project } from "./helpers.mjs"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { lifecycle } from "../src/lifecycle.mjs"

test("stdio server reports malformed JSON and continues serving requests", () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL("../src/index.mjs", import.meta.url))], {
    input: 'broken JSON\n{"jsonrpc":"2.0","id":7,"method":"ping"}\n',
    encoding: "utf8",
  }).trim().split("\n").map((line) => JSON.parse(line))
  assert.equal(output[0].error.code, -32700)
  assert.equal(output[0].id, null)
  assert.deepEqual(output[1], { jsonrpc: "2.0", id: 7, result: {} })
})

test("stdio lifecycle tools persist facts and ignored telemetry", (t) => {
  const cwd = project(t)
  execFileSync("git", ["init", "--quiet", cwd])
  writeFileSync(join(cwd, ".gitignore"), ".agents-memory.local.json\n")
  writeFileSync(join(cwd, ".agents-memory.json"), '{"version":1,"facts":[]}')
  const call = (name, args) => {
    const output = execFileSync(process.execPath, [fileURLToPath(new URL("../src/index.mjs", import.meta.url))], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: {} } }) + "\n" +
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: { cwd, ...args } } }) + "\n",
      encoding: "utf8",
    }).trim().split("\n").map((line) => JSON.parse(line))
    return output.find((message) => message.id === 2).result
  }
  assert.equal(call("memory_fact", {
    action: "add", id: "api", expectedRevision: lifecycle({ cwd }, {}).revision,
    fact: "Use migration API", scope: "database", reason: "Avoid corruption", evidence: ["docs/migrations.md"], verification: "Checked migration docs",
  }).isError, false)
  assert.equal(call("memory_feedback", { id: "api", task: "stdio-task", outcome: "useful", verification: "Verified API avoided direct edits" }).isError, false)
  assert.equal(lifecycle({ cwd }, {}).signals.length, 1)
  assert.match(call("memory_recall", { query: "migration" }).content[0].text, /Use migration API/)
  assert.equal(call("memory_fact", { action: "archive", id: "api", expectedRevision: "stale", verification: "Obsolete" }).isError, true)
  assert.equal(lifecycle({ cwd }, {}).facts[0].status, "candidate")
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
