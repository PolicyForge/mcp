# VS Code (GitHub Copilot agent mode)

## Install

One-click: **Add to VS Code** on <https://policyforge.co/mcp>, or run
"MCP: Add Server" from the command palette with:

```json
{
  "name": "policyforge",
  "command": "npx",
  "args": ["-y", "@policyforge/mcp@latest"],
  "env": { "POLICYFORGE_API_KEY": "your_key" }
}
```

On Windows, wrap the command: `"command": "cmd"`,
`"args": ["/c", "npx", "-y", "@policyforge/mcp@latest"]`.

## Try it

In Copilot Chat (agent mode):

```text
Audit our compliance — does the privacy policy cover everything this code
actually does?
```

Audits are free and unlimited; generation uses your PolicyForge quota
(free tier: 2/month + 3 bonus generations on first MCP connect).
