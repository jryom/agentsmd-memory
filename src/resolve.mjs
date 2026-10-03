// Resolve a project within MCP roots, then cwd or process.cwd(), and locate
// the memory file by walking up to the git root; nearest existing file wins.

import { existsSync, statSync } from "node:fs"
import { dirname, join, parse, isAbsolute, basename, resolve, relative, sep } from "node:path"
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
  const directories = Array.isArray(roots)
    ? roots.map((r) => rootUriToPath(r?.uri)).filter((p) => validDirectory(p)).map((p) => resolve(p))
    : []
  const cwd = validDirectory(args?.cwd) ? resolve(args.cwd) : null
  if (cwd && directories.some((dir) => {
    const path = relative(dir, cwd)
    return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  })) {
    return cwd
  }
  return directories[0] || cwd || process.cwd()
}

function validDirectory(path) {
  if (typeof path !== "string" || !isAbsolute(path)) return false
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function validFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

// Walk up from `start` to the git root or filesystem root. Try the candidate
// names in preference order; the nearest existing file wins, and within a level
// AGENTS.md beats CLAUDE.md. When none exist, create the preferred name at the
// git root (or `start` if no .git is found).
export function resolveMemoryFile(start, fileNames = memoryFileNames()) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames]
  let dir = resolve(start)
  const { root } = parse(dir)
  let projectRoot = dir
  while (true) {
    for (const name of names) {
      const candidate = join(dir, name)
      if (validFile(candidate)) return { path: candidate, exists: true }
    }
    if (existsSync(join(dir, ".git"))) {
      projectRoot = dir
      break
    }
    if (dir === root) break
    dir = dirname(dir)
  }
  const path = join(projectRoot, names[0])
  if (existsSync(path)) throw new Error(`Memory path is not a regular file: ${path}`)
  return { path, exists: false }
}
