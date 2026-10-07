import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function syncVersion(directory = fileURLToPath(new URL("..", import.meta.url))) {
  const { version } = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"))
  if (typeof version !== "string" || !version) throw new Error("Package version is missing.")
  const paths = [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]
  const manifests = paths.map((path) => JSON.parse(readFileSync(resolve(directory, path), "utf8")))
  paths.forEach((path, index) => {
    writeFileSync(resolve(directory, path), JSON.stringify({ ...manifests[index], version }, null, 2) + "\n")
  })
}

if (import.meta.main) syncVersion()
