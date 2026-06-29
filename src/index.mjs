#!/usr/bin/env node
// stdio entry: wires the server to stdin/stdout as line-delimited JSON-RPC.

import { createInterface } from "node:readline"
import { readFileSync } from "node:fs"
import { createServer } from "./server.mjs"

let version = "0.0.0"
try {
  version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version || version
} catch {}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n")
const server = createServer({ send, version })

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  Promise.resolve(server.handleMessage(msg)).catch(() => {})
})
