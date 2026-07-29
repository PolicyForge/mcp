# PolicyForge MCP Server

Generate legal policies — privacy policies, terms of service, cookie policies,
refund policies, EULAs, and disclaimers — directly from your AI coding tools
(Claude Code, Cursor, Windsurf, Claude Desktop) via the
[Model Context Protocol](https://modelcontextprotocol.io).

Ask your agent *"generate a GDPR + CCPA privacy policy for this app"* and it
fills the details from your codebase, calls PolicyForge, and drops the policy
straight into your project.

**Try it free:** compliance audits (`audit_compliance`), drift checks
(`check_policy_freshness`), and the scan rubric (`get_disclosure_checklist`)
are unlimited and never touch your quota — start with
*"audit our compliance — does the privacy policy cover everything this code
actually does?"*. And the first time your account connects through MCP it gets
**3 bonus policy generations** on top of the free 2/month — enough to generate
privacy, terms, and cookie policies for a new project in one conversation.

## Prerequisites

1. A PolicyForge account: <https://policyforge.co>
2. An API key — create one at <https://policyforge.co/api-dashboard>

## Connect

### Remote (recommended — no install)

A hosted Streamable HTTP endpoint serves the full tool set. Nothing to
install or update, and it works from any MCP client that can send a header:

```bash
claude mcp add --transport http policyforge https://policyforge.co/api/mcp \
  --header "Authorization: Bearer your_key_here"
```

For clients with URL-based MCP config (Cursor, Windsurf, and others):

```json
{
  "mcpServers": {
    "policyforge": {
      "url": "https://policyforge.co/api/mcp",
      "headers": { "Authorization": "Bearer your_key_here" }
    }
  }
}
```

### Local (npx)

Prefer a local process? The server also runs via `npx` — nothing to install
globally. Add it to your MCP client's config with your API key.

#### Claude Code

```bash
claude mcp add policyforge \
  --env POLICYFORGE_API_KEY=your_key_here \
  -- npx -y @policyforge/mcp@latest
```

#### Cursor / Claude Desktop / Windsurf

Add to your MCP config (`.cursor/mcp.json`, `claude_desktop_config.json`, etc.):

```json
{
  "mcpServers": {
    "policyforge": {
      "command": "npx",
      "args": ["-y", "@policyforge/mcp@latest"],
      "env": {
        "POLICYFORGE_API_KEY": "your_key_here"
      }
    }
  }
}
```

> On Windows, some clients need the command wrapped: set `"command": "cmd"` and
> `"args": ["/c", "npx", "-y", "@policyforge/mcp@latest"]`.

See <https://policyforge.co/mcp> for one-click installs (Cursor/VS Code) and
per-client instructions — with your API key pre-filled when signed in.

## Troubleshooting

- **401** — key deleted, disabled, or mistyped (keys start with `pf_`); rotate
  or create one at <https://policyforge.co/api-dashboard> and restart the client.
- **402** — generation quota exhausted. Free tier: 2 generations per calendar
  month, plus a one-time bonus of 3 extra generations on first MCP connect.
  Only `generate_policy`/`regenerate_policy` consume quota — audits and drift
  checks are free; ask your agent to run `get_usage` to see what's left.
- **429** — request rate limit (free tier: 10/minute, 100/day); the response
  includes `retry_after`.
- **Tools missing** — restart the client after config changes; on Windows use
  the `cmd` wrapper above.

More detail: <https://policyforge.co/mcp#troubleshooting>

## Tools

| Tool | What it does |
| --- | --- |
| `generate_policy` | Generate a policy and return its Markdown content + hosted URL. Consumes one policy from your quota. |
| `generate_baa` | Generate a HIPAA Business Associate Agreement between a covered entity and a vendor handling PHI. Built from the clauses required by 45 CFR 164.504(e) and validated clause by clause. Pro plan; never publicly hosted. Consumes one policy from your quota. |
| `regenerate_policy` | Re-run the AI engine with changed business context — same ID and hosted URL, previous content saved as a version. |
| `update_policy` | Hand-edit a policy in place — same ID and hosted URL, so published links keep working. |
| `audit_compliance` | Gap analysis: compare what the code does (your scanned manifest) with what a policy discloses. |
| `check_policy_freshness` | Drift detection: diff the current codebase scan against the manifest stored at generation time. |
| `list_policy_versions` | Version history — a snapshot is saved before every update, regeneration, or restore. |
| `restore_policy_version` | Roll a policy back to any previous version (itself reversible). |
| `list_policies` | List policies on your account (filter by type/status, paginate). |
| `get_policy` | Fetch a single policy by ID, including full content. |
| `delete_policy` | Permanently delete a policy (its hosted URL stops working). |
| `get_usage` | Check your tier and remaining generation quota before generating. |
| `get_disclosure_checklist` | The codebase-scan rubric: which SDKs/patterns require disclosure and how findings map to `generate_policy` fields. |
| `get_integration_guide` | Copy-paste embed/link instructions for Next.js, React, plain HTML, or WordPress. |
| `list_policy_types` | List supported policy types, business types, and jurisdictions. |

### The codebase-aware workflow

Your agent can read your project — so policies come from what the code *actually
does*, not what you remember it doing:

1. `get_disclosure_checklist` → agent scans dependencies, script tags, cookie
   writes, and outbound hosts against the rubric, and builds a **stack
   manifest** of what it found
2. `generate_policy` with the detected context + `stack_manifest` (stored
   server-side for drift detection)
3. `get_integration_guide` → agent wires the hosted policy into your footer
4. Later, after the stack changes: `check_policy_freshness` reports the drift,
   `audit_compliance` shows the concrete gaps, and `regenerate_policy` fixes
   them — same hosted URL, no broken links, previous version restorable

### `generate_policy` inputs

**Required:** `type`, `business_type`, `jurisdiction`, `company_name`, `contact_email`

- `type` — `privacy_policy` · `terms_of_service` · `cookie_policy` · `refund_policy` · `eula` · `disclaimer`
- `business_type` — `e-commerce` · `saas` · `healthcare` · `education` · `financial` · `fintech` · `real-estate` · `non-profit` · `consulting` · `media` · `mobile_app` · `other`
- `jurisdiction` — one or more of `gdpr` `ccpa` `pipeda` `lgpd` `us` `eu` `ca` `uk` `au` `br` `global` (comma-separate to combine, e.g. `gdpr,ccpa`)

**Optional context** (improves output): `website_url`, `service_description`,
`data_collection[]`, `third_party_integrations[]`, `data_retention`,
`user_accounts`, `payments`, `marketing`, `analytics`, `cookies`,
`children_data`, `sells_data`, `target_audience[]`, `security_measures[]`,
`governing_law`, `physical_address`, `dpo_email`, `consent_tracking`,
`hosting_enabled`.

## Configuration

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `POLICYFORGE_API_KEY` | yes | — | Your PolicyForge API key. |
| `POLICYFORGE_API_URL` | no | `https://policyforge.co` | Override the API base URL (self-host/testing). |

## How it works

This server is a thin wrapper over the PolicyForge public REST API (`/api/v1`).
Every tool maps to one authenticated HTTP request, so quota, rate limiting, and
policy generation stay authoritative on the PolicyForge server — the MCP layer
holds no secrets beyond your API key and no business logic of its own.

## License

MIT
