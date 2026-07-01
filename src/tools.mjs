// memory_save and memory_forget. Neither edits files; they resolve the nearest
// memory file and return instructions the agent applies with its own tools.

import { resolveBaseDir, resolveMemoryFile, memoryFileNames } from "./resolve.mjs"

const SAVE_RULES = `- Merge into the most relevant section; don't blindly append. Replace a superseded fact in place; combine related ones.
- Keep entries terse (fragment style) and deduped. Leave unrelated content untouched. Never write secrets.`

const ok = (text) => ({ content: [{ type: "text", text }], isError: false })
const fail = (text) => ({ content: [{ type: "text", text }], isError: true })
const filled = (v) => typeof v === "string" && v.trim().length > 0

export const tools = [
  {
    name: "memory_save",
    description:
      "Persist a durable project fact to the nearest memory file (AGENTS.md by default) so future sessions skip rediscovering it. " +
      "Call PROACTIVELY the moment you learn something lasting and non-inferable, and again when wrapping up a task that revealed one \u2014 don't wait to be asked. " +
      "Save: architecture decisions and their rationale; naming/structure conventions; non-obvious build/test/deploy commands; gotchas; tooling quirks (e.g. uses Fossil not git, runs behind a proxy); 'tried X, failed, use Y' lessons. " +
      "Don't save: transient state, secrets/credentials, anything re-derivable from the code, or one-off facts. Keep each fact to one concise sentence. " +
      "Returns instructions you carry out with your own Write/Edit tools (creating the file if none exists); it does not write files itself.",
    inputSchema: {
      type: "object",
      properties: {
        learning: { type: "string", description: "The durable fact to remember, stated concisely." },
        cwd: { type: "string", description: "Absolute path of the current project directory." },
      },
      required: ["learning"],
    },
    run(args, ctx) {
      if (!filled(args?.learning)) return fail("memory_save requires a non-empty `learning` string.")
      const { path, exists } = resolveMemoryFile(resolveBaseDir({ roots: ctx?.roots, args }), memoryFileNames())
      const learning = args.learning.trim()
      if (!exists) {
        return ok(
          `No memory file exists. Create one at ${path} with your Write tool, seeded with this fact:
"${learning}"

Give it a top-level title and concise \`##\` sections suited to the project; place the fact in the most fitting one.

Rules:
${SAVE_RULES}`,
        )
      }
      return ok(
        `Integrate this fact into ${path}:
"${learning}"

Read the current content first, then Edit.

Rules:
${SAVE_RULES}`,
      )
    },
  },
  {
    name: "memory_forget",
    description:
      "Remove outdated or wrong facts from the nearest memory file (AGENTS.md by default). Call PROACTIVELY the moment a stored fact no longer holds \u2014 don't wait to be asked. " +
      "Forget when: a fact contradicts what you observe in the code; a command/path/convention was renamed or removed; a decision was reversed; a refactor made it obsolete; or your own change invalidates an entry. " +
      "Describe what to remove in natural language (matching is fuzzy). Returns instructions you carry out with your own Read/Edit tools, leaving all other facts intact.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Natural-language description of the fact(s) to remove." },
        cwd: { type: "string", description: "Absolute path of the current project directory." },
      },
      required: ["description"],
    },
    run(args, ctx) {
      if (!filled(args?.description)) return fail("memory_forget requires a non-empty `description` string.")
      const base = resolveBaseDir({ roots: ctx?.roots, args })
      const names = memoryFileNames()
      const { path, exists } = resolveMemoryFile(base, names)
      if (!exists) return ok(`No ${names.join(" or ")} found near ${base}; nothing to forget.`)
      return ok(
        `In ${path}, remove any facts matching:
"${args.description.trim()}"

Read the current content first, then Edit. Leave everything else intact. If nothing matches, say so and change nothing.`,
      )
    },
  },
]
