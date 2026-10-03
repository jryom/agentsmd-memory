# Development and releases

Development, CI checks, and publishing use the Node.js version in `.tool-versions`. Update the pin as LTS releases arrive. The project enables strict npm engine checks in `.npmrc`.

The package retains Node.js 18+ runtime compatibility. Using LTS for development and CI does not require increasing the runtime minimum.

## Local testing

```sh
npm test
npm pack --ignore-scripts
```

Tests cover file selection, tool responses, protocol handling, reminder hooks, plugin versions, and npm package contents.

To test local server changes in a client, set the MCP command to `node` and its args to `["/absolute/path/to/agentsmd-memory/src/index.mjs"]` in a temporary configuration. The repository's `.mcp.json` runs `npx -y agentsmd-memory`, which loads the published npm package even when the plugin itself comes from a local checkout.

The server supports MCP versions `2024-11-05`, `2025-03-26`, and `2025-06-18`. Unknown initialization versions negotiate `2025-06-18`.

Tests cannot measure agent judgment. Check representative sessions before changing save policy: a routine task should make no memory edit, a repeated fact should add no duplicate, and a new gotcha should become one short rule. Requested cleanup should retain essential instructions.

## Release

1. Update `package.json`, `.codex-plugin/plugin.json`, and `.claude-plugin/plugin.json` to the same version.
2. Update `CHANGELOG.md`, run `npm test`, and inspect `npm pack --dry-run --json`.
3. Push to `main`. CI publishes the version to npm after checks pass, unless it is already published.

Plugin hooks come from the installed marketplace package; the MCP server follows npm's `latest` tag. Plugin users should update their marketplace installation and restart the client after a release. Codex may require renewed trust for changed hooks.
