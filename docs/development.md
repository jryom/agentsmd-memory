# Development and releases

Node.js 24+ is required. Development, CI checks, and publishing use the Node.js 24 version in `.tool-versions`. The project enables strict npm engine checks in `.npmrc`.

## Local testing

```sh
npm ci
npm test
npm pack --ignore-scripts
```

Tests cover file selection, tool responses, protocol handling, reminder hooks, plugin versions, and npm package contents. The lifecycle prototype additionally tests protected operations, stale revisions, atomic writes, local telemetry privacy, and concurrent writers.

To test local server changes in a client, set the MCP command to `node` and its args to `["/absolute/path/to/agentsmd-memory/src/index.mjs"]` in a temporary configuration. The repository's `.mcp.json` runs `npx -y agentsmd-memory`, which loads the published npm package even when the plugin itself comes from a local checkout.

The server supports MCP versions `2024-11-05`, `2025-03-26`, and `2025-06-18`. Unknown initialization versions negotiate `2025-06-18`.

Tests cannot measure agent judgment. Run the [memory-quality evaluations](evaluation.md) before changing save policy. Record client/model, outcomes, and diffs; wording assertions are not evidence of agent behavior.

The plugin exposes a plain V2 definition (`id`/`setup`) and V1 object entrypoint (`server`, requires OpenCode 1.18.29+), without importing a runtime SDK. V2 registers shared memory tools natively with mandatory `cwd`; MCP remains available for other clients. Contract tests exercise tool registration, execution, and context mutation, not a live OpenCode installation. Before release, verify the installed package in both supported clients: plugin appears active, tools resolve the explicit project, context gets one reminder, `MEMORY_NUDGE` works, and unloading removes tools and reminder. V2 deliberately registers only the agent-loop context hook, not title, compaction, or transient generation hooks. See the [official plugin migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1).

## Release

1. Run `npm version <version> --no-git-tag-version`; the version hook synchronizes both plugin manifests. After a manual package-version edit, run `npm run sync-version` instead.
2. Update `CHANGELOG.md`, run `npm test`, and inspect `npm pack --dry-run --json`.
3. Push to `main`. After checks pass, CI publishes the version to npm, then creates a GitHub release tagged `v<version>` with generated release notes. Existing npm versions and GitHub releases are skipped independently, so reruns can recover a missing GitHub release without republishing npm.

Plugin hooks come from the installed marketplace package; the MCP server follows npm's `latest` tag. Plugin users should update their marketplace installation and restart the client after a release. Codex may require renewed trust for changed hooks.
