// opencode plugin: per-turn reinforcement so the agent actually calls the
// memory tools. Tool descriptions alone rarely fire mid-task; injecting a short
// nudge into the system prompt before every request is the established pattern.
//
// Loaded via the package `main` field when added to opencode config as
// `"plugin": ["agentsmd-memory"]`. Independent of the MCP server (that runs via
// `bin`); importing this module has no stdio side effects.

const NUDGE =
  "If you learn a durable project fact (architecture decision, convention, " +
  "gotcha, non-obvious build/test/deploy command) call memory_save. " +
  "If you find a stored fact that is now wrong, call memory_forget. " +
  "When saving, match the structure and detail level already in the target file."

export const AgentsmdMemoryPlugin = async () => ({
  // opencode calls this before every LLM request and expects the hook to mutate
  // output.system (a string[]); the return value is discarded.
  "experimental.chat.system.transform": async (_input, output) => {
    if (!output || !Array.isArray(output.system)) return
    output.system.push(NUDGE)
  },
})

export default AgentsmdMemoryPlugin
