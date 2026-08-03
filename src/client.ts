/**
 * Thin client over the PolicyForge public REST API (/api/v1).
 *
 * The MCP server owns no business logic of its own — every tool call maps to
 * one HTTP request against the same endpoints documented for API-key users, so
 * quota, rate limiting, and generation all stay authoritative on the server.
 */

const DEFAULT_BASE_URL = "https://policyforge.co";

export class PolicyForgeError extends Error {
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "PolicyForgeError";
    this.status = status;
    this.details = details;
  }
}

export interface ClientOptions {
  /**
   * Omitted when the host has not configured a key yet. The server still
   * starts and lists its tools in that state; the failure is deferred to the
   * first request so clients and directories can introspect without auth.
   */
  apiKey?: string;
  baseUrl?: string;
  /**
   * Client-surface tag sent as X-PolicyForge-Client so the server can split
   * usage analytics by surface (e.g. "mcp-stdio" vs "mcp-remote").
   */
  clientName?: string;
}

export class PolicyForgeClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly clientName: string;

  constructor({ apiKey, baseUrl, clientName }: ClientOptions) {
    this.apiKey = apiKey;
    // Trim a trailing slash so path joins stay clean.
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.clientName = clientName || "mcp";
  }

  async generatePolicy(body: Record<string, unknown>): Promise<unknown> {
    // Generation runs an AI call server-side — allow well beyond the default.
    return this.request("POST", "/api/v1/policies", { body, timeoutMs: 180_000 });
  }

  async listPolicies(query: Record<string, string | number | undefined>): Promise<unknown> {
    return this.request("GET", "/api/v1/policies", { query });
  }

  async getPolicy(id: string): Promise<unknown> {
    return this.request("GET", `/api/v1/policies/${encodeURIComponent(id)}`);
  }

  async updatePolicy(id: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request("PATCH", `/api/v1/policies/${encodeURIComponent(id)}`, { body });
  }

  async deletePolicy(id: string): Promise<unknown> {
    return this.request("DELETE", `/api/v1/policies/${encodeURIComponent(id)}`);
  }

  async getUsage(): Promise<unknown> {
    return this.request("GET", "/api/v1/usage");
  }

  async regeneratePolicy(id: string, body: Record<string, unknown>): Promise<unknown> {
    // Runs the full AI engine server-side, like generatePolicy.
    return this.request("POST", `/api/v1/policies/${encodeURIComponent(id)}/regenerate`, {
      body,
      timeoutMs: 180_000,
    });
  }

  async auditCompliance(body: Record<string, unknown>): Promise<unknown> {
    // Server-side AI comparison of manifest vs policy — allow well beyond default.
    return this.request("POST", "/api/v1/audit", { body, timeoutMs: 150_000 });
  }

  async listPolicyVersions(id: string): Promise<unknown> {
    return this.request("GET", `/api/v1/policies/${encodeURIComponent(id)}/versions`);
  }

  async getPolicyVersion(id: string, version: number): Promise<unknown> {
    return this.request(
      "GET",
      `/api/v1/policies/${encodeURIComponent(id)}/versions/${version}`,
    );
  }

  private async request(
    method: string,
    path: string,
    opts: {
      body?: unknown;
      query?: Record<string, string | number | undefined>;
      timeoutMs?: number;
    } = {},
  ): Promise<unknown> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
      }
    }

    // Deferred to here rather than the constructor so the server can start and
    // answer tools/list without credentials. A caller that actually invokes a
    // tool gets a 401 shaped like every other auth failure.
    if (!this.apiKey) {
      throw new PolicyForgeError(
        401,
        "Missing POLICYFORGE_API_KEY. Create a key at https://policyforge.co/api-dashboard " +
          'and set it in your MCP client config, e.g. "env": { "POLICYFORGE_API_KEY": "your_key_here" }.',
      );
    }

    const timeoutMs = opts.timeoutMs ?? 30_000;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "policyforge-mcp",
          "X-PolicyForge-Client": this.clientName,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        // Never hang the agent's tool call — a stalled upstream must surface
        // as an error the MCP client can act on.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const e = err as Error;
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        throw new PolicyForgeError(
          0,
          `PolicyForge did not respond within ${Math.round(timeoutMs / 1000)}s (${method} ${path}). Try again.`,
        );
      }
      // Network-level failure (DNS, offline, TLS). Give the agent something
      // actionable rather than a bare stack trace.
      throw new PolicyForgeError(
        0,
        `Could not reach PolicyForge at ${this.baseUrl}: ${e.message}`,
      );
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const message = errorMessage(res.status, parsed);
      throw new PolicyForgeError(res.status, message, parsed);
    }

    return parsed;
  }
}

function errorMessage(status: number, parsed: unknown): string {
  const p = parsed as { error?: string; details?: unknown; retry_after?: number } | undefined;
  const base = p?.error || `Request failed with status ${status}`;

  // Common cases mapped to guidance the agent (and its user) can act on.
  if (status === 401) {
    return `${base}. Check that POLICYFORGE_API_KEY is set to a valid, active key (create one at https://policyforge.co/api-dashboard).`;
  }
  if (status === 402) {
    const d = p?.details as
      | { tier?: string; reason?: string; resets_at?: string }
      | undefined;
    // Newer API versions state the precise cause (cooldown vs daily vs
    // monthly limit) in details.reason — prefer it over the generic error.
    if (d?.reason) {
      return `${d.reason} For unlimited policies, upgrade at https://policyforge.co/pricing.`;
    }
    // Older deployments return 402 for BOTH exhausted quota and the free-tier
    // daily cooldown, with fallback numbers that aren't real usage. Don't
    // assert the numbers as fact or push an upgrade when waiting may suffice.
    const resets = d?.resets_at ? ` The monthly quota resets on ${d.resets_at}.` : "";
    return (
      `${base} On the free tier this can mean either the monthly limit is used up ` +
      `or the 24-hour cooldown between generations is still active — retrying tomorrow ` +
      `may work.${resets} For unlimited policies, upgrade at https://policyforge.co/pricing.`
    );
  }
  if (status === 429) {
    const wait = typeof p?.retry_after === "number" && p.retry_after > 0
      ? `retry after ${p.retry_after} seconds`
      : "wait a moment and retry";
    return `${base}. Rate limit reached — ${wait}.`;
  }
  if (p?.details) {
    const detailText = Array.isArray(p.details) ? p.details.join("; ") : String(p.details);
    return `${base}: ${detailText}`;
  }
  return base;
}
