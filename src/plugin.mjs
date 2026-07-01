// opencode plugin: per-turn reinforcement so the agent actually calls the
// memory tools. Tool descriptions alone rarely fire mid-task; injecting a short
// nudge into the system prompt before every request is the established pattern.
//
// Loaded via the package `main` field when added to opencode config as
// `"plugin": ["agentsmd-memory"]`. Independent of the MCP server (that runs via
// `bin`); importing this module has no stdio side effects.

export const DEFAULT_NUDGE = `Learned a durable project fact (decision, convention, gotcha, non-obvious command)? Call memory_save. Found a stored fact that's now wrong? Call memory_forget. When saving, match the structure and detail level already in the target file.`

// MEMORY_NUDGE overrides the reinforcement text. To skip injection entirely,
// don't load the plugin. Resolved per request so env changes take effect live.
// Shared with the Claude Code hook (hooks/nudge.mjs) so both clients emit the
// same text and honor the same override.
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
