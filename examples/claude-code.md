# Claude Code

## Install

```bash
claude mcp add policyforge \
  --env POLICYFORGE_API_KEY=your_key \
  -- npx -y @policyforge/mcp@latest
```

Or the hosted endpoint (nothing to install):

```bash
claude mcp add --transport http policyforge https://policyforge.co/api/mcp \
  --header "Authorization: Bearer your_key"
```

Verify with `claude mcp list` — `policyforge` should show as connected.

## First prompt (free — no quota)

```text
Audit our compliance — does the privacy policy cover everything this code
actually does?
```

The agent scans your repo against the disclosure checklist and PolicyForge
returns a gap report. Audits and drift checks are unlimited.

## The flagship workflow

```text
Scan this repository for analytics, authentication, payments and tracking.
Generate a GDPR and CCPA privacy policy that matches what the application
actually does, then add it to the website footer.
```

Expected result: the agent reads `package.json` and greps for SDKs, calls
`get_disclosure_checklist` → `generate_policy`, returns a hosted policy URL
(e.g. `policyforge.co/policy/your-company-privacy`), and edits your footer to
link it. Your first MCP connect grants 3 bonus generations on top of the free
2/month, so privacy + terms + cookie policy fit in one conversation.

## Later — drift detection

```text
Has our privacy policy gone stale since the last release? Check it against
the current code.
```
