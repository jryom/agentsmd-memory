// Resolve the workspace dir (MCP roots > cwd arg > process.cwd()) and locate
// the memory file by walking up to the git root; nearest existing file wins.

import { existsSync } from "node:fs"
import { dirname, join, parse, isAbsolute, basename } from "node:path"
import { fileURLToPath } from "node:url"

export const DEFAULT_FILE = "AGENTS.md"
// Ordered fallbacks tried after DEFAULT_FILE when MEMORY_FILE is unset. Claude
// Code auto-reads CLAUDE.md (not AGENTS.md), so a repo that only has CLAUDE.md
// should still be found; AGENTS.md stays preferred for cross-tool sharing.
export const FALLBACK_FILES = ["CLAUDE.md"]

// Ordered candidate names. A valid MEMORY_FILE override is an explicit single
// name (no fallback). Otherwise: AGENTS.md preferred, then FALLBACK_FILES.
export function memoryFileNames(env = process.env) {
  const v = env.MEMORY_FILE
  if (typeof v === "string" && v.trim()) {
    const name = basename(v.trim())
    if (name && name !== "." && name !== ".." && !/[/\\]/.test(name)) return [name]
  }
  return [DEFAULT_FILE, ...FALLBACK_FILES]
}

// Preferred/creation name (first candidate). Kept for callers that need a
// single target rather than the full ordered list.
export function memoryFileName(env = process.env) {
  return memoryFileNames(env)[0]
}

export function rootUriToPath(uri) {
  if (typeof uri !== "string" || !uri) return null
  if (uri.startsWith("file://")) {
    try {
      return fileURLToPath(uri)
    } catch {
      return null
    }
  }
  return isAbsolute(uri) ? uri : null
}

export function resolveBaseDir({ roots, args } = {}) {
  if (Array.isArray(roots)) {
    for (const r of roots) {
      const p = rootUriToPath(r?.uri)
      if (p && existsSync(p)) return p
    }
  }
  if (args?.cwd && existsSync(args.cwd)) return args.cwd
  return process.cwd()
}

// Walk up from `start` to the filesystem root. At each level, try the candidate
// names in preference order; the nearest existing file wins, and within a level
// AGENTS.md beats CLAUDE.md. When none exist, create the preferred name at the
// git root (or `start` if no .git is found).
export function resolveMemoryFile(start, fileNames = memoryFileNames()) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames]
  const { root } = parse(start)
  let dir = start
  let projectRoot = start
  let foundRoot = false
  while (true) {
    for (const name of names) {
      const candidate = join(dir, name)
      if (existsSync(candidate)) return { path: candidate, exists: true }
    }
    if (!foundRoot && existsSync(join(dir, ".git"))) {
      projectRoot = dir
      foundRoot = true
    }
    if (dir === root) break
    dir = dirname(dir)
  }
  return { path: join(projectRoot, names[0]), exists: false }
}
