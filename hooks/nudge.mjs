#!/usr/bin/env node
// Claude Code and Codex UserPromptSubmit hook: per-turn equivalent of the
// opencode plugin's system-prompt nudge. Both clients accept additionalContext
// before each prompt. Reuses resolveNudge() so every client emits identical
// text and honors MEMORY_NUDGE.

import { resolveNudge } from "../src/plugin.mjs"

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: resolveNudge(),
    },
  }),
)
