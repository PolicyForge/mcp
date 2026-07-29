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
    // stderr is safe: only stdout carries the MCP protocol stream.
    console.error(
      "[policyforge-mcp] Missing POLICYFORGE_API_KEY environment variable.\n" +
        "Create an API key at https://policyforge.co/api-dashboard and set it in your\n" +
        "MCP client config, e.g.:\n" +
        '  "env": { "POLICYFORGE_API_KEY": "your_key_here" }',
    );
    process.exit(1);
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
