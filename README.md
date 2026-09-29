# PolicyForge MCP Server

Generate legal policies — privacy policies, terms of service, cookie policies,
refund policies, EULAs, disclaimers, and HIPAA Business Associate Agreements —
directly from your AI coding tools (Claude Code, Cursor, Windsurf, Claude
Desktop) via the [Model Context Protocol](https://modelcontextprotocol.io).

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

## Connect

Pick the row that matches your client. If you're unsure, start with **A**.

| | How you sign in | Best for |
| --- | --- | --- |
| **A. Remote + OAuth** | Browser sign-in, no key to copy | Clients that support OAuth (Claude, ChatGPT) |
| **B. Remote + API key** | `Authorization` header | Any client that can send a header |
| **C. Local (npx)** | `POLICYFORGE_API_KEY` env var | Running the server as a local process |

All three expose the same tools. A and B need nothing installed.

### A. Remote with OAuth (easiest)

No key to copy, no config file to edit. You'll need a PolicyForge account
first — <https://policyforge.co>, free, no card.

**1. Add the server.** The `-s user` makes it available in every project rather
than only the directory you ran this in:

```bash
claude mcp add -s user --transport http policyforge https://policyforge.co/api/mcp
```

Note there is no `--header`. Omitting it is what makes the client use OAuth.

**2. Restart your client.** MCP config is read at startup, so a session that
was already running won't see the new server.

**3. Authenticate.** Run `/mcp`, select `policyforge`, and press Enter:

```
policyforge · △ needs authentication
```

Your browser opens, you sign in and approve, and the client stores the token
itself. You should land back at `/mcp` showing `✔ connected · 16 tools`.

To confirm from the other side, a key named `MCP · <your client>` appears at
<https://policyforge.co/api-dashboard> — that's the grant, and deleting it
revokes access.

Other clients differ in step 3: some prompt on first tool use rather than
offering an explicit authenticate action.

### B. Remote with an API key

For clients that don't do OAuth yet. Create a key at
<https://policyforge.co/api-dashboard>, then:

```bash
claude mcp add --transport http policyforge https://policyforge.co/api/mcp \
  --header "Authorization: Bearer pf_your_key_here"
```

For clients with URL-based MCP config (Cursor, Windsurf, and others):

```json
{
  "mcpServers": {
    "policyforge": {
      "url": "https://policyforge.co/api/mcp",
      "headers": { "Authorization": "Bearer pf_your_key_here" }
    }
  }
}
```

### C. Local (npx)

Prefer a local process? The server runs via `npx` — nothing to install
globally. Uses an API key from the environment, which is what the MCP spec
recommends for stdio transports.

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

- **401** — if you connected with OAuth, the authorization was revoked or
  expired: reconnect and approve again. If you used an API key, it was deleted,
  disabled, or mistyped (keys start with `pf_`) — rotate or create one at
  <https://policyforge.co/api-dashboard> and restart the client.
- **402** — generation quota exhausted. Free tier: 2 generations per calendar
  month, plus a one-time bonus of 3 extra generations on first MCP connect.
  Only `generate_policy`/`regenerate_policy` consume quota — audits and drift
  checks are free; ask your agent to run `get_usage` to see what's left.
- **429** — request rate limit (free tier: 10/minute, 100/day); the response
  includes `retry_after`.
- **Server not listed in `/mcp`** — either the session started before you added
  it (restart the client; config is read at startup), or it was added to a
  different project scope. `claude mcp add -s user …` makes it available
  everywhere.
- **Tools missing** — restart the client after config changes; on Windows use
  the `cmd` wrapper above.
- **"The redirect URI is not registered for this application"** — the client is
  using a callback URL we haven't seen. Loopback callbacks work on any port
  (per RFC 8252), so this should be rare; report the exact URI and it can be
  supported.

More detail: <https://policyforge.co/mcp#troubleshooting>

## Tools

| Tool | What it does |
| --- | --- |
| `generate_policy` | Generate a policy and return its Markdown content + hosted URL. Consumes one policy from your quota. |
| `generate_baa` | Generate a HIPAA Business Associate Agreement between a covered entity and a vendor handling PHI. Built from the clauses required by 45 CFR 164.504(e) and validated clause by clause. Pro plan; never publicly hosted. Consumes one policy from your quota. |
| `regenerate_policy` | Re-run the AI engine with changed business context — same ID and hosted URL, previous content saved as a version. |
| `check_generation` | Get the result of a generation that was still running when its tool returned a job ID (generation takes 40-60s; tools wait up to 45s). |
| `update_policy` | Edit a policy in place with find/replace edits or full content — same ID and hosted URL, so published links keep working. |
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

### `generate_baa` inputs

A Business Associate Agreement is a contract between two named parties, not a
published policy, so it takes its own tool and its own fields. **Pro plan.**

**Required:** `acknowledge_contract` (must be `true`), `baa_direction`,
`company_name`, `contact_email`, both parties' legal names and addresses,
`baa_effective_date` (`YYYY-MM-DD`), `baa_services_description`,
`baa_phi_types[]`, `baa_permitted_uses[]`, `baa_governing_law_state`.

- `baa_direction` — `covered_entity_to_vendor` (you are the practice issuing
  the agreement) or `business_associate_to_client` (you are the vendor
  offering it to a healthcare client)
- `baa_phi_types[]` — categories of PHI involved. Including
  `"Substance use treatment records (42 CFR Part 2)"` adds a Part 2 addendum
- `baa_permitted_uses[]` — anything not listed here is *not* permitted by the
  agreement (45 CFR 164.504(e)(2)(i))

**Optional:** `baa_electronic_phi` (default `true`),
`baa_uses_subcontractors` (default `false`), `baa_term_type`,
`baa_term_end_date`, `baa_breach_notification_days` (1–60, default 30),
`baa_return_or_destroy`, `baa_include_indemnification`,
`baa_include_insurance`, `baa_insurance_amount`.

Every generated agreement is checked against the 15 clauses 45 CFR 164.504(e)
requires before it is returned; an incomplete draft is refused rather than
handed back. The result is still a draft for counsel to review, and it is
never published at a public URL.

## Configuration

Only needed for the local (npx) transport. Remote connections authenticate
over OAuth or an `Authorization` header instead.

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `POLICYFORGE_API_KEY` | yes (local only) | — | Your PolicyForge API key. |
| `POLICYFORGE_API_URL` | no | `https://policyforge.co` | Override the API base URL (self-host/testing). |

## How it works

This server is a thin wrapper over the PolicyForge public REST API (`/api/v1`).
Every tool maps to one authenticated HTTP request, so quota, rate limiting, and
policy generation stay authoritative on the PolicyForge server — the MCP layer
holds no secrets beyond your API key and no business logic of its own.

## License

MIT
