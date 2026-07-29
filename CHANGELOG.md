# Changelog

## 0.5.0

- New `generate_baa` tool: HIPAA Business Associate Agreements for either side
  of the agreement — a practice issuing one to a vendor, or a vendor offering
  one to healthcare clients. Built from the clauses required by
  45 CFR 164.504(e) and validated clause by clause server-side before the
  document is returned, so an incomplete draft is refused rather than handed
  back. Pro plan; contracts are never publicly hosted.
- Kept separate from `generate_policy` deliberately: a BAA is a two-party
  contract with 20 fields that are meaningless for a cookie policy. `baa` is
  still accepted as a `list_policies` type filter.
- Tool input schemas are now generated from the API's field contract rather
  than hand-maintained, so a tool signature can no longer drift from what the
  API actually accepts.
- Server-side (no package change needed): the remote endpoint now supports
  OAuth 2.1, so clients that speak it can connect with a browser sign-in
  instead of an API key. Existing API-key connections keep working unchanged,
  and stdio still uses `POLICYFORGE_API_KEY` as the MCP spec recommends.
- `@types/node` is now a declared devDependency; the package previously only
  compiled inside the monorepo.

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
