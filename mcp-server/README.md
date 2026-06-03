# Autonomous Trencher Agent — MCP Server

First autonomous Solana trading agent on the MCP Registry.

## What is this?

An MCP server that connects Claude, Cursor, and other AI clients
to a live autonomous trading agent operating on Pump.fun (Solana + Base).

## Available Tools

| Tool | Description |
|---|---|
| get_signals | Live Pump.fun trading signals with enrichment |
| get_agent_status | Current mode, positions, PnL, uptime |
| get_consciousness_feed | Real-time agent decisions with reasoning |
| get_agent_dna | Genesis Trencher DNA profile and traits |
| get_trade_history | Closed trades with full PnL data |
| search_token | Search agent's signal database by token |

## Architecture

- 19-agent autonomous pipeline
- 3-brain LLM cascade: DeepSeek (screener) + Grok (validator) + Claude (strategist)
- Runner detection for Pump.fun reply tokens
- Proof of Consciousness: real-time decision streaming
- Multi-chain: Solana + Base

## Setup & Usage

### 1. Claude Desktop Configuration

First, install the MCP server globally on your system:
```bash
npm install -g autonomustrench-mcp-server
```

Then, add it to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "trencher-agent": {
      "command": "trencher-mcp",
      "env": {
        "TRENCHER_API_KEY": "your_api_key_here",
        "TRENCHER_API_URL": "https://trencher-core.up.railway.app"
      }
    }
  }
}
```

3. Restart Claude Desktop.

### 2. Using with Cursor IDE

After installing globally, you can add this MCP server directly from the MCP settings panel by specifying:
- **Type**: `command`
- **Command**: `trencher-mcp`
- Add the `TRENCHER_API_KEY` to the environment variables.

### Example Prompts

Once connected, you can ask your AI client things like:
- *"Show me the latest Pump.fun signals from Trencher Agent."*
- *"What did the agent decide on the last 10 tokens?"*
- *"Show me the Genesis Trencher DNA profile."*
- *"What is the agent's current win rate?"*
- *"Search the agent's database for token X."*

## Links

- Dashboard: https://autonomustrencheragent.tech
- X: @Autonomustrench
- Token: $AUTR on Solana
- Registry Listing: Officially listed on the MCP Registry.
