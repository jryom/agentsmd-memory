// opencode plugin entry; independent of the stdio server in the package `bin`.

import { resolveNudge } from "./policy.mjs"
import { tools } from "./tools.mjs"

export { DEFAULT_NUDGE, resolveNudge } from "./policy.mjs"

export const AgentsmdMemoryPlugin = async () => ({
  // opencode calls this before every LLM request and expects the hook to mutate
  // output.system (a string[]); the return value is discarded.
  "experimental.chat.system.transform": async (_input, output) => {
    if (!output || !Array.isArray(output.system)) return
    output.system.push(resolveNudge())
  },
})

// Plain V2 definition plus V1's object entrypoint (OpenCode >=1.18.29).
export default {
  id: "agentsmd-memory",
  server: AgentsmdMemoryPlugin,
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.namespace({ name: "agentsmd-memory", description: "Selective, reviewable project memory." })
      for (const tool of tools) {
        editor.add({
          name: tool.name,
          description: tool.description,
          input: { ...tool.inputSchema, required: [...(tool.inputSchema.required || []), "cwd"] },
          options: { namespace: "agentsmd-memory", codemode: true },
          execute: async (args) => {
            if (!args?.cwd) throw new Error("Pass an absolute cwd to select the project.")
            const result = await tool.run(args, {})
            const content = result.content.map((item) => item.text).join("\n")
            if (result.isError) throw new Error(content)
            return { content }
          },
        })
      }
    })
    await ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: resolveNudge() })
    })
  },
}
