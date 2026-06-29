// Resolve the workspace dir (MCP roots > cwd arg > process.cwd()) and locate
// the memory file by walking up to the git root; nearest existing file wins.

import { existsSync } from "node:fs"
import { dirname, join, parse, isAbsolute, basename } from "node:path"
import { fileURLToPath } from "node:url"

export const DEFAULT_FILE = "AGENTS.md"

// MEMORY_FILE override, reduced to a bare name to block path traversal.
export function memoryFileName(env = process.env) {
  const v = env.MEMORY_FILE
  if (typeof v !== "string" || !v.trim()) return DEFAULT_FILE
  const name = basename(v.trim())
  return !name || name === "." || name === ".." || /[/\\]/.test(name) ? DEFAULT_FILE : name
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

export function resolveMemoryFile(start, fileName = memoryFileName()) {
  const { root } = parse(start)
  let dir = start
  let projectRoot = start
  let foundRoot = false
  while (true) {
    const candidate = join(dir, fileName)
    if (existsSync(candidate)) return { path: candidate, exists: true }
    if (!foundRoot && existsSync(join(dir, ".git"))) {
      projectRoot = dir
      foundRoot = true
    }
    if (dir === root) break
    dir = dirname(dir)
  }
  return { path: join(projectRoot, fileName), exists: false }
}
