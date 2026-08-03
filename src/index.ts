#!/usr/bin/env node
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PolicyForgeClient } from "./client.js";
import { registerTools } from "./tools.js";

// Single source of truth for the version — package.json.
const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

async function main(): Promise<void> {
  const apiKey = process.env.POLICYFORGE_API_KEY;
  if (!apiKey) {
    // Warn but keep going. Exiting here meant a host could never enumerate the
    // tools before the user had configured a key, which is exactly what MCP
    // clients and directory crawlers do on first contact. Calling any tool
    // without a key still fails, with this same guidance.
    // stderr is safe: only stdout carries the MCP protocol stream.
    console.error(
      "[policyforge-mcp] No POLICYFORGE_API_KEY set — starting anyway so tools can be\n" +
        "listed, but every tool call will fail until you set one.\n" +
        "Create an API key at https://policyforge.co/api-dashboard and set it in your\n" +
        "MCP client config, e.g.:\n" +
        '  "env": { "POLICYFORGE_API_KEY": "your_key_here" }',
    );
  }

  const client = new PolicyForgeClient({
    apiKey,
    baseUrl: process.env.POLICYFORGE_API_URL,
    clientName: "mcp-stdio",
  });

  const server = new McpServer({
    name: "policyforge",
    version: pkg.version,
  });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[policyforge-mcp] ready (stdio)");
}

main().catch((err) => {
  console.error("[policyforge-mcp] fatal:", err);
  process.exit(1);
});
