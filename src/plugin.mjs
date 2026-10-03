// opencode plugin entry; independent of the stdio server in the package `bin`.

import { DEFAULT_NUDGE } from "./policy.mjs"

export { DEFAULT_NUDGE } from "./policy.mjs"

// MEMORY_NUDGE overrides the reinforcement text. To skip injection entirely,
// don't load the plugin. Resolved per request so env changes take effect live.
// Shared with the Claude Code/Codex hook (hooks/nudge.mjs) so every client
// emits the same text and honors the same override.
export function resolveNudge() {
  const v = process.env.MEMORY_NUDGE
  return v && v.trim().length > 0 ? v.trim() : DEFAULT_NUDGE
}

export const AgentsmdMemoryPlugin = async () => ({
  // opencode calls this before every LLM request and expects the hook to mutate
  // output.system (a string[]); the return value is discarded.
  "experimental.chat.system.transform": async (_input, output) => {
    if (!output || !Array.isArray(output.system)) return
    output.system.push(resolveNudge())
  },
})

export default AgentsmdMemoryPlugin
