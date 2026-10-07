import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import {
  memoryFileName,
  memoryFileNames,
  rootUriToPath,
  resolveBaseDir,
  resolveMemoryFile,
  DEFAULT_FILE,
} from "../src/resolve.mjs"

function tmp() {
  return mkdtempSync(join(tmpdir(), "agentsmd-"))
}

test("memoryFileName defaults to AGENTS.md", () => {
  assert.equal(memoryFileName({}), DEFAULT_FILE)
  assert.equal(memoryFileName({ MEMORY_FILE: "   " }), DEFAULT_FILE)
})

test("memoryFileName honors override", () => {
  assert.equal(memoryFileName({ MEMORY_FILE: "CLAUDE.md" }), "CLAUDE.md")
  assert.equal(memoryFileName({ MEMORY_FILE: "GEMINI.md" }), "GEMINI.md")
})

test("memoryFileName rejects paths and traversal", () => {
  for (const name of ["../../etc/passwd", "/abs/CLAUDE.md", "..", ".", "a\\b", "a\0b"]) {
    assert.throws(() => memoryFileName({ MEMORY_FILE: name }), /single file name/)
  }
})

test("memoryFileNames defaults to AGENTS.md then CLAUDE.md", () => {
  assert.deepEqual(memoryFileNames({}), [DEFAULT_FILE, "CLAUDE.md"])
  assert.deepEqual(memoryFileNames({ MEMORY_FILE: "   " }), [DEFAULT_FILE, "CLAUDE.md"])
})

test("memoryFileNames collapses to a single explicit override (no fallback)", () => {
  assert.deepEqual(memoryFileNames({ MEMORY_FILE: "CLAUDE.md" }), ["CLAUDE.md"])
  assert.throws(() => memoryFileNames({ MEMORY_FILE: "../../etc/passwd" }), /single file name/)
})

test("rootUriToPath converts file:// URIs", () => {
  const dir = tmp()
  try {
    assert.equal(rootUriToPath(pathToFileURL(dir).href), dir)
    assert.equal(rootUriToPath("/abs/path"), "/abs/path")
    assert.equal(rootUriToPath("https://example.com"), null)
    assert.equal(rootUriToPath(""), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("resolveBaseDir rejects explicit cwd outside roots", () => {
  const rootDir = tmp()
  const argDir = tmp()
  try {
    const roots = [{ uri: pathToFileURL(rootDir).href }]
    assert.throws(() => resolveBaseDir({ roots, args: { cwd: argDir } }), /outside/)
    assert.equal(resolveBaseDir({ roots }), rootDir)
    assert.equal(resolveBaseDir({ roots: null, args: { cwd: argDir } }), argDir)
    assert.equal(resolveBaseDir({ roots: [], args: {} }), process.cwd())
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
    rmSync(argDir, { recursive: true, force: true })
  }
})

test("resolveBaseDir rejects invalid roots and explicit cwd", () => {
  assert.throws(() => resolveBaseDir({ roots: [{ uri: "file:///no/such/dir/xyz" }] }), /workspace root/)
  for (const cwd of ["/no/such/arg", ".", "", null, 42]) {
    assert.throws(() => resolveBaseDir({ args: { cwd } }), /absolute path/)
  }
})

test("resolveMemoryFile finds nearest existing file walking up", () => {
  const root = tmp()
  try {
    writeFileSync(join(root, DEFAULT_FILE), "# root\n")
    const sub = join(root, "a", "b")
    mkdirSync(sub, { recursive: true })
    const res = resolveMemoryFile(sub)
    assert.equal(res.exists, true)
    assert.equal(res.path, join(root, DEFAULT_FILE))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("resolveMemoryFile targets git root when no file exists", () => {
  const root = tmp()
  try {
    mkdirSync(join(root, ".git"))
    const sub = join(root, "pkg", "deep")
    mkdirSync(sub, { recursive: true })
    const res = resolveMemoryFile(sub)
    assert.equal(res.exists, false)
    assert.equal(res.path, join(root, DEFAULT_FILE))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("resolveMemoryFile respects custom file name", () => {
  const root = tmp()
  try {
    writeFileSync(join(root, "CLAUDE.md"), "# claude\n")
    const res = resolveMemoryFile(root, "CLAUDE.md")
    assert.equal(res.exists, true)
    assert.equal(res.path, join(root, "CLAUDE.md"))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("resolveMemoryFile falls back to CLAUDE.md when AGENTS.md is absent", () => {
  const root = tmp()
  try {
    writeFileSync(join(root, "CLAUDE.md"), "# claude\n")
    const res = resolveMemoryFile(root)
    assert.equal(res.exists, true)
    assert.equal(res.path, join(root, "CLAUDE.md"))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("resolveMemoryFile prefers AGENTS.md when both exist at the same level", () => {
  const root = tmp()
  try {
    writeFileSync(join(root, "AGENTS.md"), "# agents\n")
    writeFileSync(join(root, "CLAUDE.md"), "# claude\n")
    const res = resolveMemoryFile(root)
    assert.equal(res.exists, true)
    assert.equal(res.path, join(root, DEFAULT_FILE))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("resolveMemoryFile: nearer CLAUDE.md wins over a farther AGENTS.md", () => {
  const root = tmp()
  try {
    writeFileSync(join(root, "AGENTS.md"), "# far agents\n")
    const sub = join(root, "pkg")
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(sub, "CLAUDE.md"), "# near claude\n")
    const res = resolveMemoryFile(sub)
    assert.equal(res.exists, true)
    assert.equal(res.path, join(sub, "CLAUDE.md"))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("resolveMemoryFile creates AGENTS.md at git root when nothing exists", () => {
  const root = tmp()
  try {
    mkdirSync(join(root, ".git"))
    const sub = join(root, "a")
    mkdirSync(sub, { recursive: true })
    const res = resolveMemoryFile(sub)
    assert.equal(res.exists, false)
    assert.equal(res.path, join(root, DEFAULT_FILE))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("project cwd selects a nested project or the matching workspace root", () => {
  const first = tmp()
  const second = tmp()
  try {
    const sub = join(second, "project")
    mkdirSync(sub)
    const roots = [first, second].map((dir) => ({ uri: pathToFileURL(dir).href }))
    assert.equal(resolveBaseDir({ roots, args: { cwd: sub } }), sub)
    assert.equal(resolveBaseDir({ roots, args: { cwd: second } }), second)
  } finally {
    rmSync(first, { recursive: true, force: true })
    rmSync(second, { recursive: true, force: true })
  }
})

test("resolver rejects file paths and relative cwd arguments", () => {
  const dir = tmp()
  try {
    const file = join(dir, "file")
    writeFileSync(file, "content")
    assert.throws(() => resolveBaseDir({ roots: [{ uri: pathToFileURL(file).href }] }), /workspace root/)
    assert.throws(() => resolveBaseDir({ args: { cwd: file } }), /absolute path/)
    assert.throws(() => resolveBaseDir({ args: { cwd: "." } }), /absolute path/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("multiple distinct roots require cwd; duplicate roots are not ambiguous", () => {
  const first = tmp()
  const second = tmp()
  try {
    const roots = [first, second].map((dir) => ({ uri: pathToFileURL(dir).href }))
    assert.throws(() => resolveBaseDir({ roots }), /Multiple workspace roots/)
    assert.equal(resolveBaseDir({ roots: [roots[0], roots[0]] }), first)
  } finally {
    rmSync(first, { recursive: true, force: true })
    rmSync(second, { recursive: true, force: true })
  }
})

test("symlinks cannot bypass workspace containment", () => {
  const root = tmp()
  const outside = tmp()
  try {
    symlinkSync(outside, join(root, "outside"), "dir")
    const roots = [{ uri: pathToFileURL(root).href }]
    assert.throws(() => resolveBaseDir({ roots, args: { cwd: join(root, "outside") } }), /outside/)
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test("git boundary prevents unrelated parent memory being selected", () => {
  const parent = tmp()
  try {
    writeFileSync(join(parent, "AGENTS.md"), "# Parent\n")
    const project = join(parent, "project")
    mkdirSync(join(project, ".git"), { recursive: true })
    assert.deepEqual(resolveMemoryFile(project), { path: join(project, "AGENTS.md"), exists: false })
    writeFileSync(join(project, "CLAUDE.md"), "# Project\n")
    assert.deepEqual(resolveMemoryFile(project), { path: join(project, "CLAUDE.md"), exists: true })
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test("worktree .git files bound resolution and directories are not memory files", () => {
  const parent = tmp()
  try {
    writeFileSync(join(parent, "AGENTS.md"), "# Parent\n")
    const project = join(parent, "project")
    mkdirSync(join(project, "AGENTS.md"), { recursive: true })
    writeFileSync(join(project, ".git"), "gitdir: /elsewhere\n")
    assert.throws(() => resolveMemoryFile(project), /not a regular file/)
    rmSync(join(project, "AGENTS.md"), { recursive: true })
    assert.deepEqual(resolveMemoryFile(project), { path: join(project, "AGENTS.md"), exists: false })
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})
