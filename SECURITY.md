# Security

## Model

- The MCP server is a **thin client** over the PolicyForge public REST API
  (`/api/v1`). It stores no data, holds no secrets beyond the API key you give
  it, and contains no business logic — quota, rate limiting, and generation
  are enforced server-side per key.
- Revoking the API key at <https://policyforge.co/api-dashboard> kills all
  access instantly.
- Destructive tools (`delete_policy`, content overwrites) carry MCP
  destructive annotations so well-behaved clients confirm before running
  them, and every update/regeneration snapshots the previous version first.

## Handling your API key

- Pass `POLICYFORGE_API_KEY` as an environment variable, or use the
  `${POLICYFORGE_API_KEY}` placeholder in a committed `.mcp.json`. Never
  commit a real key.
- Keys start with `pf_`. Rotate them anytime from the API dashboard.

## Prompt injection

Content from other tools in your agent's context could try to trigger
PolicyForge actions. Keep human confirmation on for destructive tools and
only run MCP servers you trust alongside this one.

## Reporting a vulnerability

Email **support@policyforge.co** with the details. Please do not open a
public issue for security reports. We aim to acknowledge within 48 hours.
