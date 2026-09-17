# Faultline — install instructions for AI agents

Faultline is a **remote** MCP server. There is nothing to install locally, no build step, and no package to clone.

## Setup

Add this entry to the user's MCP client configuration (Claude Code, Cursor, Cline, VS Code, opencode, or any MCP client that supports streamable HTTP):

```json
{
  "mcpServers": {
    "faultline": {
      "url": "https://gauntlet.mcpize.run/mcp"
    }
  }
}
```

- Transport: `streamable-http`
- Authentication: OAuth 2.1 — on first use the client opens a browser and the user signs in to MCPize. No API key is pasted into config.
- OAuth discovery: `https://gauntlet.mcpize.run/.well-known/oauth-protected-resource`

## Verify

After adding the server, call the `generate_test_suite` tool with any small piece of code:

```json
{ "code": "export function add(a, b) { return a + b; }", "file_path": "add.js" }
```

A successful response returns a runnable test suite with 25+ tests and a coverage report.

## Optional: make it automatic

Add to the project's rules file (CLAUDE.md / AGENTS.md / .cursor/rules):

> Whenever you create or modify code that accepts input, touches money, handles dates, or manages state — call the Faultline tool (generate_test_suite) before marking the task complete.

## Troubleshooting

- If the server shows as unauthorized, complete the sign-in flow that opens in the browser.
