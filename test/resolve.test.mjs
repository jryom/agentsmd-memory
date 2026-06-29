import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import {
  memoryFileName,
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

test("memoryFileName strips paths and rejects traversal", () => {
  assert.equal(memoryFileName({ MEMORY_FILE: "../../etc/passwd" }), "passwd")
  assert.equal(memoryFileName({ MEMORY_FILE: "/abs/CLAUDE.md" }), "CLAUDE.md")
  assert.equal(memoryFileName({ MEMORY_FILE: ".." }), DEFAULT_FILE)
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

test("resolveBaseDir: roots beats cwd-arg beats process.cwd()", () => {
  const rootDir = tmp()
  const argDir = tmp()
  try {
    const roots = [{ uri: pathToFileURL(rootDir).href }]
    assert.equal(resolveBaseDir({ roots, args: { cwd: argDir } }), rootDir)
    assert.equal(resolveBaseDir({ roots: null, args: { cwd: argDir } }), argDir)
    assert.equal(resolveBaseDir({ roots: [], args: {} }), process.cwd())
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
    rmSync(argDir, { recursive: true, force: true })
  }
})

test("resolveBaseDir skips non-existent roots and cwd", () => {
  assert.equal(
    resolveBaseDir({ roots: [{ uri: "file:///no/such/dir/xyz" }], args: { cwd: "/no/such/arg" } }),
    process.cwd(),
  )
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
