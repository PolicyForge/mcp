# OpenAI Responses API (and ChatGPT)

## ChatGPT status

Custom MCP apps with full write actions are rolling out in beta for ChatGPT
Business, Enterprise, and Edu workspaces (Settings → Connectors, developer
mode). ChatGPT Plus does not get the same install flow yet — if you're on
Plus, use the Responses API below or a coding agent (Claude Code, Cursor).

## Responses API

The PolicyForge remote MCP endpoint is a public Streamable HTTP server, so
you can attach it to any Responses API call:

```python
from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp",
        "server_label": "policyforge",
        "server_url": "https://policyforge.co/api/mcp",
        "headers": {"Authorization": "Bearer your_policyforge_key"},
        "require_approval": "never",
    }],
    input="List my PolicyForge policies, then check my remaining generation quota.",
)
print(resp.output_text)
```

Notes:

- Auth is your PolicyForge API key (`pf_…`) from
  <https://policyforge.co/api-dashboard> — sent as a normal Bearer header.
- The model can't scan a local repo from the Responses API; pass your stack
  facts in the prompt, or use `audit_compliance` with a manifest you build:

```text
Call audit_compliance with this manifest:
{"analytics":["posthog"],"payments":["stripe"],"auth":["supabase"],
 "cookies":["session"],"jurisdiction_signals":["EU locales"]}
```
