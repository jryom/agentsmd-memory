import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("stdio server reports malformed JSON and continues serving requests", () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL("../src/index.mjs", import.meta.url))], {
    input: 'broken JSON\n{"jsonrpc":"2.0","id":7,"method":"ping"}\n',
    encoding: "utf8",
  }).trim().split("\n").map((line) => JSON.parse(line))
  assert.equal(output[0].error.code, -32700)
  assert.equal(output[0].id, null)
  assert.deepEqual(output[1], { jsonrpc: "2.0", id: 7, result: {} })
})
