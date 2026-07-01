#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: the per-turn equivalent of the opencode
// plugin's system-prompt nudge. Claude Code has no system-prompt transform, so
// we inject the reminder via `additionalContext`, which fires before every
// prompt is processed. Reuses resolveNudge() from the opencode plugin so both
// clients emit identical text and honor MEMORY_NUDGE.

import { resolveNudge } from "../src/plugin.mjs"

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: resolveNudge(),
    },
  }),
)
