# Changelog

## 0.8.0

- Generation no longer times out in MCP clients. Generating a policy takes
  40-60 seconds, and most MCP clients abandon a tool call after 60 seconds
  while the server finishes anyway, so a retry created a duplicate policy.
  `generate_policy`, `generate_baa` and `regenerate_policy` now start a
  background job, wait for it for up to 45 seconds while sending progress
  notifications, and return the result as before when it is ready. If it is
  still running, they return a job ID instead.
- New `check_generation` tool: returns the result of a job, its error, or
  that it is still running. Tool output tells the agent to use it rather than
  start the generation again.
- `get_policy` on a new policy that is still being generated reports the job
  instead of "not found" (the job ID is also the new policy's ID).
- Requires the API's `?async=true` generation mode and `GET /api/v1/jobs/{id}`,
  both live on policyforge.co. Against a server without them, the tools fall
  back to waiting for the synchronous response.

## 0.7.0

- `update_policy` accepts `edits`: a list of exact find/replace pairs applied
  to the current content, so a one-line fix no longer means resubmitting the
  whole document. Each `find` must match exactly once, and if any edit fails
  to match, none are applied. Cannot be combined with `content`.
- `update_policy` warns when an update introduces repeated consecutive lines.
- Corrected the `update_policy` description: every content or title update
  saves the previous version first, so `restore_policy_version` can undo it.
- `generate_policy` and `regenerate_policy` list the claims to verify that the
  API now returns: specific statements about third parties, certifications,
  data transfer frameworks or deadlines that the inputs did not supply, plus
  any marker left for a missing detail such as governing law.
- `generate_policy` tells agents to ask for `governing_law` for terms of
  service, EULAs and disclaimers.
- `get_integration_guide` notes that the hosted link and the embed both make
  visitors' browsers contact policyforge.co, and adds a third option that
  renders the policy on the site's own page from the API.
- Server-side (no package change needed): `stack_manifest` is accepted again.
  Since late July 2026 every request carrying it was rejected with "stack_manifest must
  be a string". Generated policies no longer state an AI provider's retention
  period, EU-US Data Privacy Framework reliance, a breach notification
  deadline in hours, certifications or encryption standards unless the inputs
  supplied them.

## 0.6.1

- The server now starts without `POLICYFORGE_API_KEY` instead of exiting, so a
  host can list its tools before the user has configured a key. Previously it
  called `process.exit(1)` before ever serving `tools/list`, which meant MCP
  clients and directory crawlers saw a server that failed to start rather than
  one awaiting credentials. Calling any tool without a key still fails, now as
  a normal 401 carrying the same setup guidance.
- Added a `Dockerfile` so the server can be built and introspected in a clean
  container.

## 0.6.0

- Tool schemas regenerated from the API field contract, adding
  `table_of_contents`: a Pro option that prefixes a generated document with a
  bulleted list of anchor links to each section.
- Server-side (no package change needed): privacy policies, terms of service
  and EULAs gained substantially more clause coverage. Privacy now includes a
  CCPA/CPRA categories table with retention per category, the controller and
  processor split for business products, GPC signals, sub-processor change
  notification and an EU representative section. Terms gained a data export
  window on termination, mutual indemnities, confidentiality, force majeure,
  beta terms, an arbitration opt-out and an order of precedence. EULAs gained
  a third-party and open-source components notice, export control, U.S.
  Government restricted rights and a cap on direct damages.
- Where a third-party AI provider is detected, privacy policies and terms now
  state explicitly whether customer content is used to train models, how long
  the provider retains it, and that output needs review.
- The commercial clauses in terms of service require a Pro plan; everything
  legally required remains available on the free tier.

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
