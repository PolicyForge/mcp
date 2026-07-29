import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PolicyForgeClient, PolicyForgeError } from "./client.js";

// --- Enumerations mirrored from the PolicyForge public API -------------------
// Field schemas in ./generated/contract.js are generated from the API's field
// contract and published with each release — do not hand-edit them here.

import { CONTEXT_FIELDS, BAA_FIELDS } from "./generated/contract.js";

const POLICY_TYPES = [
  "privacy_policy",
  "terms_of_service",
  "cookie_policy",
  "refund_policy",
  "eula",
  "disclaimer",
] as const;

// 'baa' is a contract, not a policy: it needs two named parties and a PHI scope,
// so it has its own tool (generate_baa) rather than an option on generate_policy.
// It is still a valid filter value when listing existing documents.
const LISTABLE_POLICY_TYPES = [...POLICY_TYPES, "baa"] as const;

const BAA_DIRECTIONS = [
  "covered_entity_to_vendor",
  "business_associate_to_client",
] as const;

const BUSINESS_TYPES = [
  "e-commerce",
  "saas",
  "healthcare",
  "education",
  "financial",
  "fintech",
  "real-estate",
  "non-profit",
  "consulting",
  "media",
  "mobile_app",
  "mobile-app",
  "other",
] as const;

// Jurisdictions are validated individually but may be combined comma-separated
// (e.g. "gdpr,ccpa"), so the field is a free string with a documented value set.
// Country/region names are case-sensitive upstream — keep the capitalization.
const JURISDICTIONS = [
  "gdpr",
  "ccpa",
  "pipeda",
  "lgpd",
  "us",
  "eu",
  "ca",
  "uk",
  "au",
  "br",
  "global",
  "Europe",
  "Canada",
  "United Kingdom",
  "Australia",
  "Brazil",
  "India",
  "Singapore",
  "Japan",
  "Mexico",
];

// --- Disclosure rubric ---------------------------------------------------------
// The legal-domain knowledge the local agent needs to turn a codebase scan into
// accurate generate_policy inputs. The agent is the sensor (it can read the
// repo); this rubric is the legal brain (what each finding means in a policy).

const DISCLOSURE_CHECKLIST = `# PolicyForge disclosure checklist

Use this rubric to scan the user's codebase BEFORE generating or updating
policies. Fill generate_policy's optional fields from what you find in the
code — only ask the user for facts you cannot detect (legal company name,
contact email, physical address, governing law). Users forget what their
stack does; the code doesn't.

## How to scan
Check package.json / requirements / go.mod dependencies, environment variable
names, script tags in HTML/layouts, outbound request hosts, and cookie writes
(document.cookie, Set-Cookie, cookie libraries).

## Detection → disclosure mapping

### Analytics & product tracking → analytics: true, add to third_party_integrations
posthog-js, mixpanel, amplitude, @vercel/analytics, react-ga / gtag.js /
googletagmanager.com, plausible, fathom, umami, heap, matomo.
Data collected: usage/behavioral data, device info, IP. Most set cookies →
cookies: true and a cookie_policy is needed.

### Session replay & error monitoring → analytics: true, disclose session recording
sentry (@sentry/*), logrocket, fullstory, hotjar, datadoghq-browser-agent,
clarity.ms. Session replay captures user interactions and must be disclosed
explicitly; error monitors send stack traces + device metadata off-site.

### Advertising & pixels → disclose ad tracking + opt-out; consider sells_data
fbevents.js / Facebook Pixel, Google Ads / doubleclick, TikTok pixel,
LinkedIn Insight. Under CCPA, pixel-based ad targeting can count as
"sharing/selling" personal information → sells_data may need to be true and a
"Do Not Sell or Share" section is required for California users.

### Payments → payments: true, add processor to third_party_integrations
stripe / @stripe/*, paypal, lemonsqueezy, paddle, square, braintree, razorpay.
Card data goes to the processor (not stored locally — say so). If the product
sells anything, also generate a refund_policy.

### Auth & user accounts → user_accounts: true; data_collection: ["email","name"]
supabase auth, firebase/auth, auth0, clerk, next-auth, passport, cognito,
OAuth providers (google, github…). OAuth = data received from the identity
provider; list the providers.

### Email & marketing → marketing: true (if campaigns/newsletters, not just transactional)
resend, sendgrid, mailchimp, postmark, klaviyo, brevo, loops, customer.io.
Transactional-only email does NOT require marketing: true — check how it's used.

### AI features → disclose AI processing and data sent to model providers
openai, anthropic, @google/generative-ai, groq, replicate, AI gateway URLs.
Disclose: user content is processed by third-party AI providers, name them,
state whether inputs are used for model training (check the provider tier).

### Embedded third parties that receive visitor IPs → add to third_party_integrations
fonts.googleapis.com (IP transmitted to Google — an EU court found this a GDPR
violation without disclosure), Google Maps, YouTube/Vimeo embeds, Intercom /
Crisp / tawk.to chat widgets, CDN-hosted scripts, reCAPTCHA / Turnstile.

### Cookies → cookies: true; generate a cookie_policy
document.cookie writes, js-cookie, Set-Cookie headers, any analytics/ads tool
above. Distinguish essential (session, consent) from non-essential
(analytics, ads) — non-essential cookies for EU users require prior consent.

### Children → children_data
Only true if the product is directed at children or knowingly collects their
data (COPPA / GDPR-K). Look for age gates, kids content, school products.

### Jurisdiction signals → jurisdiction
i18n locales / translations, currencies, shipping regions, TLDs, user base.
EU users → "gdpr"; California/US → "ccpa"; Canada → "pipeda"; Brazil → "lgpd".
When in doubt for a global web product, use "gdpr,ccpa".

### Security measures → security_measures
TLS/HTTPS, encryption at rest, RLS/row-level access controls, MFA, backups,
SOC 2 / ISO mentions. Only list what's actually true.

## Which policies does the project need?
- Collects ANY personal data (forms, accounts, analytics) → privacy_policy (always)
- Has user accounts, subscriptions, or paid service → terms_of_service
- Sets any non-essential cookies → cookie_policy
- Sells products/subscriptions → refund_policy
- Ships downloadable/installable software or a mobile app → eula
- Publishes advice/content (financial, health, legal, affiliate) → disclaimer

## After scanning
Summarize your findings as a stack manifest object, e.g.
{"analytics":["posthog"],"payments":["stripe"],"auth":["supabase"],
"ai_features":["openai"],"cookies":["session"],"third_parties":["fonts.googleapis.com"],
"user_data_collected":["email","usage_events"],"jurisdiction_signals":["EU locales"]}
and pass it as stack_manifest to generate_policy / regenerate_policy — it is
stored server-side so check_policy_freshness can detect drift later. Then:
- get_integration_guide to wire the policy into the site
- audit_compliance to verify existing policies against the manifest
- after dependency changes: check_policy_freshness, then update_policy (small
  wording fixes) or regenerate_policy (context changed substantially).`;

const STACK_MANIFEST_FIELD = z
  .record(z.unknown())
  .optional()
  .describe(
    "Structured summary of the stack you detected while scanning the codebase " +
      '(see get_disclosure_checklist), e.g. {"analytics":["posthog"],"payments":["stripe"],' +
      '"auth":["supabase"],"ai_features":["openai"],"cookies":["session"],' +
      '"jurisdiction_signals":["EU locales"]}. Stored server-side so ' +
      "check_policy_freshness can detect drift when the stack changes later. " +
      "Provide it whenever you scanned the project.",
  );

/**
 * Deterministic manifest diff for drift detection — arrays are compared as
 * sets, everything else by value. Runs locally: the agent supplies the fresh
 * scan, the stored manifest comes from the policy row.
 */
function diffManifests(stored: unknown, current: unknown): string[] {
  const a = (stored ?? {}) as Record<string, unknown>;
  const b = (current ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[key];
    const bv = b[key];
    if (Array.isArray(av) || Array.isArray(bv)) {
      const as = new Set((Array.isArray(av) ? av : []).map(String));
      const bs = new Set((Array.isArray(bv) ? bv : []).map(String));
      const added = [...bs].filter((x) => !as.has(x));
      const removed = [...as].filter((x) => !bs.has(x));
      if (added.length) lines.push(`${key}: ADDED ${added.join(", ")}`);
      if (removed.length) lines.push(`${key}: REMOVED ${removed.join(", ")}`);
    } else if (JSON.stringify(av) !== JSON.stringify(bv)) {
      lines.push(`${key}: changed from ${JSON.stringify(av)} to ${JSON.stringify(bv)}`);
    }
  }
  return lines;
}

interface SubscriptionInfo {
  tier?: string;
  remaining_policies?: number;
}

/**
 * Render the remaining-quota line. Pro/Enterprise get a large sentinel from
 * the API (999 minus usage), not a real quota — show "unlimited" instead of
 * leaking the sentinel arithmetic.
 */
function remainingLine(info: SubscriptionInfo | undefined): string | null {
  if (!info || info.remaining_policies === undefined) return null;
  if (info.tier === "pro" || info.tier === "enterprise" || info.remaining_policies >= 900) {
    return "Remaining this period: unlimited";
  }
  return `Remaining this period: ${info.remaining_policies}`;
}

/** Wrap a handler so upstream errors become clean MCP tool errors, not crashes. */
function safe(
  fn: (args: any) => Promise<{ content: any[]; isError?: boolean }>,
) {
  return async (args: any) => {
    try {
      return await fn(args);
    } catch (err) {
      const msg =
        err instanceof PolicyForgeError
          ? err.message
          : `Unexpected error: ${(err as Error).message}`;
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * Framework-specific install instructions for a hosted policy. Snippet formats
 * mirror the in-app installation guide (PolicyInstallationGuide / embed.js docs):
 *   <script src="https://policyforge.co/embed.js"></script>
 *   <div data-policyforge-id="SLUG"></div>
 */
function integrationGuide(
  title: string,
  hostedUrl: string,
  slug: string,
  framework: "nextjs" | "react" | "html" | "wordpress" | "other",
): string {
  const embedDiv = `<div data-policyforge-id="${slug}"></div>`;
  const embedScript = `<script src="https://policyforge.co/embed.js"></script>`;

  const header = [
    `# Integrating "${title}"`,
    "",
    "Two options — pick one:",
    "",
    `**Option A — link to the hosted page (simplest):** add a footer link to ${hostedUrl}`,
    "PolicyForge serves, styles, and updates the page; nothing to maintain.",
    "",
    "**Option B — embed the policy inside your own page:** the snippet below injects",
    "the policy content inline (no iframe), so it inherits your site's typography.",
    "Content updates made in PolicyForge propagate automatically — no redeploy.",
    "",
  ].join("\n");

  const byFramework: Record<string, string> = {
    html: [
      "```html",
      "<!-- anywhere in the page body -->",
      embedScript,
      embedDiv,
      "```",
    ].join("\n"),
    nextjs: [
      "```tsx",
      `// app/privacy/page.tsx (adjust the route to the policy type)`,
      `import Script from "next/script";`,
      "",
      "export default function PolicyPage() {",
      "  return (",
      "    <main>",
      `      ${embedDiv}`,
      `      <Script src="https://policyforge.co/embed.js" strategy="afterInteractive" />`,
      "    </main>",
      "  );",
      "}",
      "```",
    ].join("\n"),
    react: [
      "```tsx",
      "// PolicyPage.tsx",
      'import { useEffect } from "react";',
      "",
      "export default function PolicyPage() {",
      "  useEffect(() => {",
      '    const s = document.createElement("script");',
      '    s.src = "https://policyforge.co/embed.js";',
      "    document.body.appendChild(s);",
      "    return () => { s.remove(); };",
      "  }, []);",
      `  return ${embedDiv};`,
      "}",
      "```",
    ].join("\n"),
    wordpress: [
      'In the page editor, add a **Custom HTML** block containing:',
      "```html",
      embedScript,
      embedDiv,
      "```",
    ].join("\n"),
    other: [
      "Add these two lines wherever your platform allows raw HTML:",
      "```html",
      embedScript,
      embedDiv,
      "```",
    ].join("\n"),
  };

  const footer = [
    "",
    "**Finish the job:**",
    `- Add a footer link to the policy on every page (convention users and regulators expect).`,
    "- If the site sets non-essential cookies for EU visitors, a consent banner is",
    "  required — one can be created in the PolicyForge dashboard (Cookie Banner),",
    "  which provides its own snippet with a banner ID.",
    "- After major dependency changes, re-run get_disclosure_checklist and update",
    "  the policy with update_policy so it keeps matching the code.",
  ].join("\n");

  return `${header}${byFramework[framework]}\n${footer}`;
}

export function registerTools(server: McpServer, client: PolicyForgeClient): void {
  server.registerTool(
    "generate_policy",
    {
      title: "Generate policy",
      description:
        "Generate a legal policy (privacy policy, terms of service, cookie policy, " +
        "refund policy, EULA, or disclaimer) for a business and return its Markdown " +
        "content plus a hosted URL. Consumes one policy from the account's quota. " +
        "IMPORTANT: if you are working inside the user's project, call " +
        "get_disclosure_checklist and scan the codebase FIRST (dependencies, script " +
        "tags, cookie writes, outbound hosts), then fill the optional fields below " +
        "from what the code actually does — do not ask the user for facts you can " +
        "read from source. Only ask for what code cannot tell you: legal company " +
        "name, contact email, physical address, governing law.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: z.enum(POLICY_TYPES).describe("The kind of policy to generate."),
        business_type: z
          .enum(BUSINESS_TYPES)
          .describe("The company's business category."),
        jurisdiction: z
          .string()
          .min(1)
          .describe(
            "Target legal framework(s). One or more of: " +
              JURISDICTIONS.join(", ") +
              '. Combine multiple comma-separated, e.g. "gdpr,ccpa". ' +
              "Country/region names are case-sensitive as listed.",
          ),
        company_name: z.string().min(1).describe("Legal/display name of the company."),
        contact_email: z
          .string()
          .email()
          .describe("Public contact email for legal inquiries."),
        ...CONTEXT_FIELDS,
        stack_manifest: STACK_MANIFEST_FIELD,
        consent_tracking: z
          .boolean()
          .optional()
          .describe('Enable the "I agree" consent banner on the hosted page (default false).'),
        hosting_enabled: z
          .boolean()
          .optional()
          .describe("Host the policy at a public policyforge.co URL (default true)."),
      },
    },
    safe(async (args) => {
      const result = (await client.generatePolicy(args)) as {
        id: string;
        title: string;
        content: string;
        hosted_url?: string;
        subscription_info?: SubscriptionInfo;
      };
      const lines = [`# ${result.title}`, `Policy ID: ${result.id}`];
      if (result.hosted_url) lines.push(`Hosted URL: ${result.hosted_url}`);
      const remaining = remainingLine(result.subscription_info);
      if (remaining) lines.push(remaining);
      lines.push("", "---", "", result.content);
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "generate_baa",
    {
      title: "Generate a HIPAA Business Associate Agreement",
      description:
        "Generate a HIPAA Business Associate Agreement (BAA) between a covered entity " +
        "and a vendor that handles Protected Health Information. Built from the clauses " +
        "required by 45 CFR 164.504(e) and validated clause by clause before it is returned. " +
        "\n\nUse this instead of generate_policy for BAAs — a BAA is a binding two-party " +
        "contract, not a published policy, so it needs both parties' legal names and " +
        "addresses and is never hosted at a public URL. " +
        "\n\nAsk the user for the party details, effective date, and governing law: these " +
        "are negotiated facts you cannot read from source code. Requires a Pro plan. " +
        "The result is a draft for counsel to review, not executed legal advice.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        company_name: z.string().min(1).describe("Legal name of the user's own company."),
        contact_email: z.string().email().describe("Contact email for the agreement."),
        // The 18 contract fields are generated from the shared policy contract.
        ...BAA_FIELDS,
      },
    },
    safe(async (args) => {
      const result = (await client.generatePolicy({
        ...args,
        type: "baa",
        // The API requires these on every generation; a BAA is healthcare by
        // definition and its governing law is carried by baa_governing_law_state.
        business_type: "healthcare",
        jurisdiction: "us",
      })) as {
        id: string;
        title: string;
        content: string;
        subscription_info?: SubscriptionInfo;
      };
      const lines = [`# ${result.title}`, `Policy ID: ${result.id}`];
      const remaining = remainingLine(result.subscription_info);
      if (remaining) lines.push(remaining);
      lines.push(
        "",
        "> This is a draft contract, not legal advice. Both parties should have counsel " +
          "review it before signing. It is stored privately and is not publicly hosted.",
        "",
        "---",
        "",
        result.content,
      );
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "list_policies",
    {
      title: "List policies",
      description:
        "List the policies previously created on this PolicyForge account, newest first.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Max results (1-100, default 20)."),
        offset: z.number().int().min(0).optional().describe("Pagination offset."),
        status: z
          .enum(["draft", "published", "archived"])
          .optional()
          .describe("Filter by status."),
        type: z.enum(LISTABLE_POLICY_TYPES).optional().describe("Filter by policy type."),
        sortBy: z
          .enum(["createdAt", "updatedAt", "name"])
          .optional()
          .describe("Sort field (default updatedAt)."),
        sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort direction (default desc)."),
      },
    },
    safe(async (args) => {
      const result = await client.listPolicies(args);
      return textResult(JSON.stringify(result, null, 2));
    }),
  );

  server.registerTool(
    "get_policy",
    {
      title: "Get policy",
      description:
        "Retrieve a single policy by ID, including its status, hosted URL, and full Markdown content.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("The policy ID (UUID) returned by generate_policy or list_policies."),
      },
    },
    safe(async ({ id }) => {
      const result = (await client.getPolicy(id)) as {
        id?: string;
        type?: string;
        title?: string;
        content?: string;
        status?: string;
        hosted_url?: string;
        url_slug?: string;
        created_at?: string;
        updated_at?: string;
      };
      if (!result?.content) {
        return textResult(JSON.stringify(result, null, 2));
      }
      // Surface the metadata alongside the content — hosted_url especially is
      // something agents get asked for and must not be hidden.
      const lines = [`# ${result.title ?? "Policy"}`];
      if (result.id) lines.push(`Policy ID: ${result.id}`);
      if (result.type) lines.push(`Type: ${result.type}`);
      if (result.status) lines.push(`Status: ${result.status}`);
      if (result.hosted_url) lines.push(`Hosted URL: ${result.hosted_url}`);
      if (result.created_at) lines.push(`Created: ${result.created_at}`);
      if (result.updated_at) lines.push(`Updated: ${result.updated_at}`);
      lines.push("", "---", "", result.content);
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "update_policy",
    {
      title: "Update policy",
      description:
        "Update an existing policy in place — the policy ID, hosted URL, and embed " +
        "keep working, so links already published on the user's site stay valid. " +
        "Use this instead of generate_policy when the business context changed " +
        "(new SDK, new data flow, renamed company): fetch the current content with " +
        "get_policy, revise the Markdown yourself, and submit it here. " +
        "Note: there is no version history — the previous content is overwritten.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID) to update."),
        title: z.string().min(1).optional().describe("New policy title."),
        content: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Full replacement Markdown content. Submit the COMPLETE document, not a diff.",
          ),
        status: z
          .enum(["draft", "published", "archived"])
          .optional()
          .describe("Change publication status. Only 'published' policies are served at the hosted URL."),
        effective_date: z
          .string()
          .optional()
          .describe('New effective date, ISO format e.g. "2026-07-13".'),
        hosting_enabled: z
          .boolean()
          .optional()
          .describe("Enable/disable the public hosted page."),
        consent_tracking: z
          .boolean()
          .optional()
          .describe('Enable/disable the "I agree" consent banner on the hosted page.'),
      },
    },
    safe(async ({ id, ...fields }) => {
      const updates = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(updates).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No fields to update. Provide at least one of: title, content, status, effective_date, hosting_enabled, consent_tracking.",
            },
          ],
          isError: true,
        };
      }
      const result = (await client.updatePolicy(id, updates)) as {
        id?: string;
        title?: string;
        status?: string;
        hosted_url?: string;
        updated_at?: string;
      };
      const lines = [
        `Policy updated: ${result.title ?? id}`,
        `Policy ID: ${result.id ?? id}`,
        `Updated fields: ${Object.keys(updates).join(", ")}`,
      ];
      if (result.status) lines.push(`Status: ${result.status}`);
      if (result.hosted_url) lines.push(`Hosted URL: ${result.hosted_url} (unchanged — existing links keep working)`);
      if (result.updated_at) lines.push(`Updated at: ${result.updated_at}`);
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "regenerate_policy",
    {
      title: "Regenerate policy",
      description:
        "Re-run the AI generation engine over a policy's stored business context " +
        "merged with the changed fields you provide — same policy ID and hosted " +
        "URL, so published links keep working. The previous content is saved as a " +
        "version first (see list_policy_versions / restore_policy_version). " +
        "Consumes one generation from quota, like generate_policy. Use this when " +
        "the business context changed substantially (new integrations, new " +
        "jurisdiction, renamed company); for small wording fixes prefer " +
        "update_policy, which is free and instant.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID) to regenerate."),
        company_name: z.string().min(1).optional().describe("Changed company name."),
        contact_email: z.string().email().optional().describe("Changed contact email."),
        jurisdiction: z
          .string()
          .min(1)
          .optional()
          .describe('Changed legal framework(s), e.g. "gdpr,ccpa".'),
        business_type: z.enum(BUSINESS_TYPES).optional().describe("Changed business category."),
        ...CONTEXT_FIELDS,
        stack_manifest: STACK_MANIFEST_FIELD,
      },
    },
    safe(async ({ id, ...changes }) => {
      const body = Object.fromEntries(
        Object.entries(changes).filter(([, v]) => v !== undefined),
      );
      const result = (await client.regeneratePolicy(id, body)) as {
        id: string;
        title?: string;
        content?: string;
        hosted_url?: string;
        previous_version_saved?: boolean;
        subscription_info?: SubscriptionInfo;
      };
      const lines = [
        `# ${result.title ?? "Policy regenerated"}`,
        `Policy ID: ${result.id}`,
      ];
      if (result.hosted_url) {
        lines.push(`Hosted URL: ${result.hosted_url} (unchanged — existing links keep working)`);
      }
      lines.push(
        result.previous_version_saved === false
          ? "Warning: the previous content could NOT be saved as a version."
          : "Previous content saved as a version (restore_policy_version can undo this).",
      );
      const remaining = remainingLine(result.subscription_info);
      if (remaining) lines.push(remaining);
      if (result.content) lines.push("", "---", "", result.content);
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "audit_compliance",
    {
      title: "Audit compliance",
      description:
        "Compliance gap analysis: submit the stack manifest you built by scanning " +
        "the codebase (see get_disclosure_checklist), optionally with a policy_id " +
        "to audit against. PolicyForge compares what the code does with what the " +
        "policy discloses and returns missing disclosures, overstated claims, " +
        "missing policy types, and recommendations. Without a policy_id it audits " +
        "the manifest alone (which policies are needed and what they must cover). " +
        "Does not consume generation quota.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        manifest: z
          .record(z.unknown())
          .describe(
            "The detected-stack summary from your codebase scan, e.g. " +
              '{"analytics":["posthog"],"payments":["stripe"],"ai_features":["openai"],' +
              '"cookies":["session","_ph_*"],"jurisdiction_signals":["EU locales"],' +
              '"user_data_collected":["email","usage_events"]}.',
          ),
        policy_id: z
          .string()
          .optional()
          .describe("Policy (UUID) to audit the manifest against. Omit to audit the manifest alone."),
      },
    },
    safe(async ({ manifest, policy_id }) => {
      const result = (await client.auditCompliance(
        policy_id ? { manifest, policy_id } : { manifest },
      )) as {
        audit?: {
          summary?: string;
          missing_disclosures?: Array<{
            finding?: string;
            manifest_evidence?: string;
            why_required?: string;
            severity?: string;
          }>;
          inaccurate_or_overstated?: Array<{ finding?: string; why?: string }>;
          missing_policies?: Array<{ type?: string; why?: string }>;
          recommendations?: string[];
        };
        audited_policy_id?: string | null;
      };
      const a = result.audit;
      if (!a) return textResult(JSON.stringify(result, null, 2));
      const lines: string[] = ["# Compliance audit"];
      if (result.audited_policy_id) lines.push(`Audited policy: ${result.audited_policy_id}`);
      if (a.summary) lines.push("", a.summary);
      if (a.missing_disclosures?.length) {
        lines.push("", "## Missing disclosures");
        for (const f of a.missing_disclosures) {
          lines.push(
            `- [${(f.severity ?? "medium").toUpperCase()}] ${f.finding}` +
              (f.manifest_evidence ? ` (evidence: ${f.manifest_evidence})` : "") +
              (f.why_required ? ` — ${f.why_required}` : ""),
          );
        }
      }
      if (a.inaccurate_or_overstated?.length) {
        lines.push("", "## Inaccurate or overstated claims");
        for (const f of a.inaccurate_or_overstated) {
          lines.push(`- ${f.finding}${f.why ? ` — ${f.why}` : ""}`);
        }
      }
      if (a.missing_policies?.length) {
        lines.push("", "## Missing policies");
        for (const f of a.missing_policies) {
          lines.push(`- ${f.type}${f.why ? ` — ${f.why}` : ""}`);
        }
      }
      if (a.recommendations?.length) {
        lines.push("", "## Recommendations");
        for (const r of a.recommendations) lines.push(`- ${r}`);
      }
      if (
        !a.missing_disclosures?.length &&
        !a.inaccurate_or_overstated?.length &&
        !a.missing_policies?.length
      ) {
        lines.push("", "No gaps found between the manifest and the audited policy.");
      }
      lines.push(
        "",
        "Fix gaps with update_policy (hand-edited) or regenerate_policy (full AI re-run with the corrected context).",
      );
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "check_policy_freshness",
    {
      title: "Check policy freshness",
      description:
        "Drift detection: scan the codebase now (get_disclosure_checklist), build " +
        "the current stack manifest, and compare it against the manifest stored " +
        "when the policy was last generated/regenerated. Reports what changed in " +
        "the stack so you know whether the policy still matches the code. Runs " +
        "locally on the two manifests — no AI call, no quota.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID) to check."),
        current_manifest: z
          .record(z.unknown())
          .describe("The stack manifest from your fresh codebase scan."),
      },
    },
    safe(async ({ id, current_manifest }) => {
      const policy = (await client.getPolicy(id)) as {
        title?: string;
        updated_at?: string;
        stack_manifest?: Record<string, unknown> | null;
      };
      if (!policy.stack_manifest) {
        return textResult(
          `No stack manifest is stored for "${policy.title ?? id}", so drift can't be measured yet. ` +
            "Pass stack_manifest on your next generate_policy or regenerate_policy call to enable " +
            "freshness tracking — meanwhile, use audit_compliance to compare the current manifest " +
            "against the policy content directly.",
        );
      }
      const drift = diffManifests(policy.stack_manifest, current_manifest);
      if (drift.length === 0) {
        return textResult(
          `No drift: the stack matches the manifest stored when "${policy.title ?? id}" was last generated` +
            (policy.updated_at ? ` (updated ${policy.updated_at})` : "") +
            ". The policy still reflects the codebase.",
        );
      }
      return textResult(
        [
          `# Stack drift detected for "${policy.title ?? id}"`,
          policy.updated_at ? `Policy last updated: ${policy.updated_at}` : "",
          "",
          "Changes since the stored manifest:",
          ...drift.map((d) => `- ${d}`),
          "",
          "The policy may no longer disclose what the code does. Recommended next steps:",
          "1. audit_compliance with the current manifest + this policy_id to see the concrete gaps",
          "2. regenerate_policy with the changed context (and the new stack_manifest) to fix them",
        ]
          .filter((l) => l !== null)
          .join("\n"),
      );
    }),
  );

  server.registerTool(
    "list_policy_versions",
    {
      title: "List policy versions",
      description:
        "Version history for a policy: snapshots taken before every API update, " +
        "regeneration, or restore, plus any auto-generated compliance update " +
        "drafts. Use get-version content via restore_policy_version, or fetch a " +
        "single version's content with this policy's versions endpoint.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID)."),
      },
    },
    safe(async ({ id }) => {
      const result = (await client.listPolicyVersions(id)) as {
        versions?: Array<{
          version_number: number;
          title?: string;
          change_summary?: string;
          is_auto_generated?: boolean;
          review_status?: string;
          created_at?: string;
        }>;
      };
      const versions = result.versions ?? [];
      if (versions.length === 0) {
        return textResult(
          "No versions yet. Snapshots are created automatically before every update_policy, " +
            "regenerate_policy, or restore_policy_version call.",
        );
      }
      const lines = [`# Versions (${versions.length})`, ""];
      for (const v of versions) {
        const flags = [
          v.is_auto_generated ? "auto-generated" : null,
          v.review_status && !["approved", "snapshot"].includes(v.review_status)
            ? `review: ${v.review_status}`
            : null,
        ]
          .filter(Boolean)
          .join(", ");
        lines.push(
          `- v${v.version_number} — ${v.created_at ?? "?"} — ${v.change_summary ?? v.title ?? ""}` +
            (flags ? ` [${flags}]` : ""),
        );
      }
      lines.push("", "Restore any of these with restore_policy_version.");
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "restore_policy_version",
    {
      title: "Restore policy version",
      description:
        "Restore a policy to a previous version from list_policy_versions. The " +
        "current content is snapshotted as a new version first, so a restore is " +
        "itself reversible. The hosted URL is unchanged.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID)."),
        version: z
          .number()
          .int()
          .min(1)
          .describe("The version_number to restore (from list_policy_versions)."),
      },
    },
    safe(async ({ id, version }) => {
      const snapshot = (await client.getPolicyVersion(id, version)) as {
        version_number: number;
        title?: string;
        content?: string;
      };
      if (!snapshot?.content) {
        return {
          content: [
            { type: "text", text: `Version ${version} has no content to restore.` },
          ],
          isError: true,
        };
      }
      // PATCH snapshots the outgoing content server-side before applying.
      const updated = (await client.updatePolicy(id, {
        content: snapshot.content,
        ...(snapshot.title ? { title: snapshot.title } : {}),
      })) as { hosted_url?: string; updated_at?: string };
      const lines = [
        `Restored policy ${id} to version ${version}.`,
        "The replaced content was snapshotted as a new version first (see list_policy_versions).",
      ];
      if (updated.hosted_url) lines.push(`Hosted URL: ${updated.hosted_url} (unchanged)`);
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "delete_policy",
    {
      title: "Delete policy",
      description:
        "Permanently delete a policy. The hosted URL and any embeds of it stop " +
        "working immediately, and this cannot be undone. Confirm with the user " +
        "before deleting anything they may have linked from their site.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID) to delete."),
      },
    },
    safe(async ({ id }) => {
      await client.deletePolicy(id);
      return textResult(
        `Policy ${id} permanently deleted. Its hosted URL and embeds no longer work.`,
      );
    }),
  );

  server.registerTool(
    "get_usage",
    {
      title: "Get usage & quota",
      description:
        "Check the account's subscription tier and remaining policy-generation " +
        "quota. Call this before generate_policy on accounts that may be on the " +
        "free tier, so you can plan instead of hitting quota errors.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {},
    },
    safe(async () => {
      const usage = (await client.getUsage()) as {
        tier?: string;
        unlimited?: boolean;
        can_generate?: boolean;
        remaining?: number | null;
        limit?: number | null;
        used?: number | null;
        resets_at?: string | null;
        reason?: string | null;
      };
      const lines = [`Tier: ${usage.tier ?? "unknown"}`];
      if (usage.unlimited) {
        lines.push("Quota: unlimited");
      } else {
        if (usage.remaining !== null && usage.remaining !== undefined) {
          lines.push(`Remaining generations: ${usage.remaining}`);
        }
        if (usage.limit !== null && usage.limit !== undefined) {
          lines.push(`Monthly limit: ${usage.used ?? "?"}/${usage.limit} used`);
        }
        if (usage.resets_at) lines.push(`Quota resets: ${usage.resets_at}`);
      }
      lines.push(`Can generate now: ${usage.can_generate ? "yes" : "no"}`);
      if (!usage.can_generate && usage.reason) lines.push(`Why not: ${usage.reason}`);
      return textResult(lines.join("\n"));
    }),
  );

  server.registerTool(
    "get_disclosure_checklist",
    {
      title: "Get disclosure checklist",
      description:
        "Get the rubric for scanning a codebase before generating or updating " +
        "policies: which SDKs, scripts, and patterns legally require disclosure, " +
        "and how each finding maps to generate_policy's fields. Call this before " +
        "generate_policy when working inside the user's project — policies " +
        "derived from the actual code beat policies from memory.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {},
    },
    safe(async () => textResult(DISCLOSURE_CHECKLIST)),
  );

  server.registerTool(
    "get_integration_guide",
    {
      title: "Get integration guide",
      description:
        "Get copy-paste instructions for wiring a generated policy into the " +
        "user's site: hosted link, embed snippet, and framework-specific " +
        "placement. Call this after generate_policy to finish the job — a " +
        "generated policy helps nobody until it's linked from the site.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: z.string().min(1).describe("The policy ID (UUID) to integrate."),
        framework: z
          .enum(["nextjs", "react", "html", "wordpress", "other"])
          .optional()
          .describe("The site's framework, for tailored snippets (default: html)."),
      },
    },
    safe(async ({ id, framework }) => {
      const policy = (await client.getPolicy(id)) as {
        title?: string;
        status?: string;
        hosted_url?: string;
        url_slug?: string;
        hosting_enabled?: boolean;
      };
      if (!policy.hosted_url || !policy.url_slug) {
        return textResult(
          `This policy has no hosted URL${policy.hosting_enabled === false ? " (hosting is disabled — enable it with update_policy { hosting_enabled: true })" : ""}. ` +
            "Without hosting you can still paste the Markdown from get_policy into your own page.",
        );
      }
      const note =
        policy.status !== "published"
          ? `\n> Note: this policy's status is "${policy.status}" — the hosted URL only serves published policies. Publish with update_policy { status: "published" }.\n`
          : "";
      return textResult(
        integrationGuide(policy.title ?? "Policy", policy.hosted_url, policy.url_slug, framework ?? "html") + note,
      );
    }),
  );

  server.registerTool(
    "list_policy_types",
    {
      title: "List policy types",
      description:
        "List the supported policy types, business types, and jurisdictions accepted " +
        "by generate_policy. Call this first if unsure which enum values are valid.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {},
    },
    safe(async () => {
      return textResult(
        JSON.stringify(
          {
            policy_types: POLICY_TYPES,
            business_types: BUSINESS_TYPES,
            jurisdictions: JURISDICTIONS,
            contract_types: {
              baa: "HIPAA Business Associate Agreement — use the generate_baa tool, not generate_policy. Requires a Pro plan.",
            },
            notes:
              "jurisdiction accepts one value or several comma-separated (e.g. 'gdpr,ccpa'). " +
              "Country/region names are case-sensitive as listed. " +
              "list_policies also accepts 'baa' as a type filter.",
          },
          null,
          2,
        ),
      );
    }),
  );
}
