# Changelog

## 0.4.0

- Send `X-PolicyForge-Client` header so server-side analytics can attribute
  MCP usage (stdio vs remote) separately from raw REST.
- Server-side (no package change needed): first MCP-authenticated request on
  a free account now grants a one-time bonus of 3 extra policy generations,
  and free-tier API quota was aligned with the product promise (2/month
  calendar reset — the old lifetime cap and 24h cooldown are gone).

## 0.3.x

- Remote Streamable HTTP endpoint at `https://policyforge.co/api/mcp`.
- 14-tool set: generate/regenerate/update policies, compliance audit, drift
  detection, version history + restore, integration guides, usage.
- Windows `cmd` wrapper documented for npx-based configs.

## 0.2.x / 0.1.x

- Initial public releases: stdio server over the public REST API.
