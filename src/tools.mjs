// memory_save and memory_forget. Neither edits files; they resolve the nearest
// memory file and return instructions the agent applies with its own tools.
// Only exception: memory_save bootstraps a missing file directly.

import { writeFileSync } from "node:fs"
import { basename, dirname } from "node:path"
import { resolveBaseDir, resolveMemoryFile, memoryFileName } from "./resolve.mjs"

const SAVE_RULES = [
  "Merge into the most relevant existing section (do not blindly append).",
  "If it supersedes an existing fact, replace that line. If related, combine.",
  "Dedup. Keep entries concise (terse, fragment style).",
  "Save only durable truths: decisions, conventions, architecture, gotchas, non-inferable tooling.",
  "Never save: transient state, task progress, file contents, or secrets (tokens/keys/passwords).",
  "Preserve all unrelated content untouched.",
  "If the memory grows beyond ~150 lines, consolidate aggressively.",
]
  .map((r) => `- ${r}`)
  .join("\n")

const ok = (text) => ({ content: [{ type: "text", text }], isError: false })
const fail = (text) => ({ content: [{ type: "text", text }], isError: true })
const filled = (v) => typeof v === "string" && v.trim().length > 0

export const tools = [
  {
    name: "memory_save",
    description:
      "Persist a durable project fact to the nearest AGENTS.md so future sessions skip rediscovering it. " +
      "Call this PROACTIVELY the moment you learn something lasting and non-inferable \u2014 do not wait to be asked. " +
      "Triggers: an architecture decision or its rationale; a naming/structure convention; a build/test/deploy command that isn't obvious; " +
      "a gotcha or footgun you hit; a tooling quirk (e.g. uses Fossil not git, runs behind a proxy); a 'we tried X, it failed, use Y instead' lesson. " +
      "Also call it when WRAPPING UP a task that revealed any such fact: before you report completion, ask yourself 'did I learn something a future session would have to rediscover?' and if so, save it. " +
      "Do NOT save: transient state (current bug, a path you're editing now), secrets/credentials, anything trivially re-derivable from the code, " +
      "or facts the user explicitly said are one-off. Keep each fact one concise sentence. " +
      "Returns merge instructions which you then carry out with your own Read/Edit tools. " +
      "Exception: if no memory file exists yet, this creates it directly and no further action is needed.",
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
      const { path, exists } = resolveMemoryFile(resolveBaseDir({ roots: ctx?.roots, args }), memoryFileName())
      const learning = args.learning.trim()
      if (!exists) {
        const project = basename(dirname(path)) || "project"
        writeFileSync(
          path,
          `# ${project}\n\nProject memory for AI agents. Durable facts only.\n\n## Notes\n- ${learning}\n`,
        )
        return ok(`Created ${path} with this fact. No further action needed \u2014 do not edit it again for this save.`)
      }
      return ok(
        [
          `Update the memory file: ${path}`,
          "",
          "Integrate this learning as a durable project fact:",
          `"${learning}"`,
          "",
          "Rules:",
          SAVE_RULES,
          "",
          "Use your Read tool to inspect current content first, then Edit.",
        ].join("\n"),
      )
    },
  },
  {
    name: "memory_forget",
    description:
      "Remove outdated or wrong facts from the nearest AGENTS.md. Call this PROACTIVELY the moment you notice a stored fact no longer holds \u2014 do not wait to be asked. " +
      "Triggers: you read AGENTS.md and a fact contradicts what you observe in the code; a command/path/convention it describes has been renamed or removed; " +
      "a decision it records was reversed; a refactor made it obsolete; or you just changed something that invalidates an existing entry. " +
      "Whenever you act on a fact from memory, sanity-check it against reality first \u2014 if it's stale, forget it. " +
      "Keeping stale memory is worse than none: it misleads future sessions. Describe what to remove in natural language; " +
      "matching is fuzzy. Returns instructions which you then carry out with your own Read/Edit tools, leaving all other facts intact.",
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
      const fileName = memoryFileName()
      const { path, exists } = resolveMemoryFile(base, fileName)
      if (!exists) return ok(`No ${fileName} found near ${base}; nothing to forget.`)
      return ok(
        [
          `In ${path}, remove any facts matching:`,
          `"${args.description.trim()}"`,
          "",
          "Leave all other content intact. If nothing matches, report that and make no change.",
          "Use your Read tool to inspect current content first, then Edit.",
        ].join("\n"),
      )
    },
  },
]
