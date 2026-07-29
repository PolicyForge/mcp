# Cursor

## Install

One-click: use the **Add to Cursor** button on <https://policyforge.co/mcp>
(deeplink installs the npx server with your key inlined when signed in).

Or add manually to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "policyforge": {
      "command": "npx",
      "args": ["-y", "@policyforge/mcp@latest"],
      "env": { "POLICYFORGE_API_KEY": "your_key" }
    }
  }
}
```

Remote alternative (no local process):

```json
{
  "mcpServers": {
    "policyforge": {
      "url": "https://policyforge.co/api/mcp",
      "headers": { "Authorization": "Bearer your_key" }
    }
  }
}
```

Restart Cursor after editing the config, then check Settings → MCP shows the
14 PolicyForge tools.

## Try it

In Composer/Agent mode:

```text
Scan this codebase and generate a privacy policy that matches what the app
actually does, then add it to the site footer.
```

Free first step (no quota): ask for a compliance audit instead of a
generation — audits are unlimited.
