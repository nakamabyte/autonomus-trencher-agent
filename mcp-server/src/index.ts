#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.TRENCHER_API_URL || "https://trencher-core.up.railway.app";
const API_KEY = process.env.TRENCHER_API_KEY || "";

async function fetchApi(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const server = new McpServer({
  name: "Autonomous Trencher Agent",
  version: "1.0.0",
  description: "First autonomous Solana trading agent on MCP. 19 agents, 3 LLM brains (DeepSeek + Grok + Claude), real-time runner detection on Pump.fun.",
});

// Tool 1: Get Signals
server.tool(
  "get_signals",
  "Get latest Pump.fun trading signals with enrichment data including runner detection, smart money overlap, and LLM confidence scores",
  {
    chain: z.enum(["solana", "base"]).default("solana").describe("Blockchain to query signals from"),
    limit: z.number().min(1).max(50).default(10).describe("Number of signals to return"),
  },
  async ({ chain, limit }) => {
    const data = await fetchApi(`/api/signals?chain=${chain}&limit=${limit}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Tool 2: Agent Status
server.tool(
  "get_agent_status",
  "Get current agent status including trading mode, active strategy, open positions, PnL, uptime, and number of active nodes",
  {},
  async () => {
    const data = await fetchApi("/api/status");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Tool 3: Consciousness Feed
server.tool(
  "get_consciousness_feed",
  "Get the real-time agent decision feed (Proof of Consciousness). Each decision shows token, confidence score, rug probability, runner signal, and BUY/SKIP verdict with reasoning",
  {
    limit: z.number().min(1).max(50).default(15).describe("Number of recent decisions"),
  },
  async ({ limit }) => {
    const data = await fetchApi(`/api/signals/enriched?limit=${limit}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Tool 4: Agent DNA
server.tool(
  "get_agent_dna",
  "Get the Genesis Trencher DNA profile including breed, 11 trait scores (Speed, Aggression, Rug Defense, etc), performance stats, and survival score",
  {
    limit: z.number().optional().describe("Number of DNA profiles to return (defaults to all)"),
  },
  async ({ limit }) => {
    const url = limit ? `/api/agent/dna?limit=${limit}` : "/api/agent/dna";
    const data = await fetchApi(url);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Tool 5: Trade History
server.tool(
  "get_trade_history",
  "Get closed trade history with full PnL data, entry/exit mcap, hold duration, strategy, and exit reason",
  {
    limit: z.number().min(1).max(100).default(20).describe("Number of trades to return"),
    chain: z.enum(["solana", "base"]).default("solana").describe("Chain to filter"),
  },
  async ({ limit, chain }) => {
    const data = await fetchApi(`/api/trades?limit=${limit}&chain=${chain}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Tool 6: Search Token
server.tool(
  "search_token",
  "Search for a token in the agent signal database. Returns last seen confidence, verdict, enrichment data, and whether the agent bought or skipped it",
  {
    query: z.string().describe("Token symbol or mint address to search"),
  },
  async ({ query }) => {
    const data = await fetchApi(`/api/search?q=${encodeURIComponent(query)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Trencher Agent MCP server running on stdio");
}

main().catch(console.error);
