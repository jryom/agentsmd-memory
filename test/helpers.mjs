import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export function project(t, { git = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "agentsmd-"))
  if (git) mkdirSync(join(directory, ".git"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}
