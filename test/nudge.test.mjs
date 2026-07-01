import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("../hooks/nudge.mjs", import.meta.url))

function run(env = {}) {
  const out = execFileSync(process.execPath, [script], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  })
  return JSON.parse(out)
}

test("emits a UserPromptSubmit additionalContext payload", () => {
  const { hookSpecificOutput } = run()
  assert.equal(hookSpecificOutput.hookEventName, "UserPromptSubmit")
  assert.match(hookSpecificOutput.additionalContext, /memory_save/)
  assert.match(hookSpecificOutput.additionalContext, /memory_forget/)
})

test("MEMORY_NUDGE overrides the injected text", () => {
  const { hookSpecificOutput } = run({ MEMORY_NUDGE: "custom reminder" })
  assert.equal(hookSpecificOutput.additionalContext, "custom reminder")
})

test("empty MEMORY_NUDGE falls back to the default text", () => {
  const { hookSpecificOutput } = run({ MEMORY_NUDGE: "   " })
  assert.match(hookSpecificOutput.additionalContext, /memory_save/)
})
