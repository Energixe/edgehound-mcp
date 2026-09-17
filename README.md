# Faultline

An MCP server that writes test suites designed to break your code.

This repo is the public front door — install guide, examples, and issue tracking. The generation engine runs as a hosted service, so there is nothing here to build or self-host.

## What it does

Point your AI agent at a file, and Faultline writes a complete, runnable test suite that attacks it: boundary values, unicode and emoji, timezone and month-end math, float money rounding, double submits, injection strings, pagination edges. It also predicts — before you run anything — which bugs the suite will expose, with the exact code evidence for each.

Works with Claude Code, Cursor, opencode, VS Code, and any MCP client.

## Install

Add the server to your MCP config:

```json
{
  "mcpServers": {
    "faultline": {
      "url": "https://gauntlet.mcpize.run/mcp"
    }
  }
}
```

On first use your client will ask you to sign in to MCPize. After that:

> "write tests for src/pricing.ts"

and your agent does the rest.

## Make it automatic

Paste this into your project's rules file (`CLAUDE.md`, `AGENTS.md`, or `.cursor/rules`), and your agent will reach for Faultline every time it writes or changes input-handling code — no prompting needed:

```
Whenever you create or modify code that accepts input, touches money, handles
dates, or manages state — call the Faultline tool (generate_test_suite) before
marking the task complete. Save the returned suite next to the file, run it,
and fix any failing test by fixing the code, not by weakening the test.
Skip only for pure UI markup, copy changes, and configuration.
```

## What a run looks like

`examples/user-utils.js` has four innocent-looking helpers. A real generation produced 60 tests — 55 passed, 5 failed. Every failure was a real bug in the sample:

- `parseDuration('1h30m')` returns 3600 — it silently drops the minutes
- `monthlyPrice` leaks float drift on non-divisible cents
- half-value money rounding is unhandled
- negative input produces a negative price
- `truncate` blows up when handed a number instead of a string

Try it:

```bash
node --test examples/user-utils.test.js
```

Languages today: JavaScript/TypeScript (Jest, Vitest, node:test), Python (pytest), Go, PHP (PHPUnit), Ruby (RSpec), Rust (cargo test).

## Issues

Bugs, weird output, missing languages — open an issue here. We read everything and ship fixes fast. Want Go/Rust/PHP improvements or a language we don't cover yet (Java, C#, Swift)? Say so in an issue; demand decides what gets added next.

## Status

v1.1 — predicted-bug reports, syntax-validated output with auto-repair, multi-file context, 8 test frameworks.
