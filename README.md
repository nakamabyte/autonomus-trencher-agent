> **Trencher Agent** is built on top of [Charon](https://github.com/yunus-0x/charon) by [@yunus-0x](https://github.com/yunus-0x).
> It extends Charon with a 2-tier multi-LLM cascade screener, trusted KOL signal detection, and a full Next.js web dashboard.
> See [ATTRIBUTION.md](./ATTRIBUTION.md) for full details.

---

# Trencher Agent

> AI-powered Solana trench orchestrator. 19 autonomous agents — signal ingestion, LLM screening, Jupiter execution, Telegram control.

⚠️ **Codebase is in testing period. Developer does not guarantee any result.**

---

## Repository Structure

```
trencher-agent/
├── trencher-web/    # Frontend — Next.js 16 · React 19 · TypeScript · Tailwind CSS v4
├── trencher-core/   # Backend  — Node.js · SQLite · Telegram Bot · Jupiter Ultra
└── signal-server/   # Signal   — Express · Solana WS · Pump.fun · Jupiter Trending
```

---

## `trencher-core` — Backend Service

The core agent orchestrator. Monitors Pump.fun token flow, enriches candidates, and executes via Jupiter Ultra.

### 🧠 2-Tier LLM Cascade Architecture
Trencher uses a multi-agent LLM pipeline to balance speed, cost, and analytical depth:
1. **Tier 1 (Bulk Screener):** Powered by DeepSeek for rapid, high-volume, initial-pass candidate filtering.
2. **Tier 2 (KOL Validator & Analyst):** Powered by Grok to analyze Twitter/CT narratives, validate trusted KOLs for edge cases, and perform post-trade analysis via `/learn`.

**Stack:** Node.js (ESM) · `better-sqlite3` · `node-telegram-bot-api` · `@solana/web3.js` v1 · `ws`

### Quick Start

```bash
cd trencher-core
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

For PM2:
```bash
pm2 start index.js --name trencher-agent && pm2 save
```

### Required `.env`

```env
# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Signal server (run signal-server locally or on a VPS)
SIGNAL_SERVER_URL=http://localhost:4000
SIGNAL_SERVER_KEY=your_signal_server_api_key

# Solana RPC
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=

# Execution mode: dry_run | confirm | live
TRADING_MODE=dry_run

# Multi-Tier LLM Architecture (Cascade)
ENABLE_LLM=true

# TIER 1: DeepSeek (Bulk Screener)
LLM_T1_BASE_URL=https://api.deepseek.com/v1
LLM_T1_API_KEY=
LLM_T1_MODEL=deepseek-chat

# TIER 2: Grok (KOL & CT Validator, Post-hoc Analysis)
LLM_T2_BASE_URL=https://api.x.ai/v1
LLM_T2_API_KEY=
LLM_T2_MODEL=grok-2-latest

# Live/confirm mode only
SOLANA_PRIVATE_KEY=
JUPITER_API_KEY=
```

### Execution Modes

| Mode | Description |
|---|---|
| `dry_run` | Simulated trades in SQLite. No wallet needed. |
| `confirm` | Telegram Approve/Reject buttons before every swap. |
| `live` | Fully autonomous — signs and submits immediately. |

### Strategies

```bash
/strategy sniper      # Fee-claim overlap, LLM on, fast exit
/strategy dip_buy     # ATH-distance dip entry, wider TP
/strategy smart_money # Strict holder quality, partial TP
/strategy degen       # Rule-based only, no LLM
/stratset sniper tp_percent 75
```

### Key Telegram Commands

```
/menu          /strategy      /stratset <id> <key> <value>
/positions     /candidate <mint>
/pnl           /learn <window>   /lessons
/walletadd <label> <address>     /wallets
```

### Storage

All state in `trencher-agent.sqlite` — positions, decisions, strategies, wallets, lessons. Open positions **auto-resume** after restart.

---

## `signal-server` — Signal Aggregation Service

Independent microservice that collects token data from Pump.fun (graduated), Jupiter (trending), and Solana WebSocket (fee claims), then serves merged signals via REST API.

**Stack:** Node.js · Express · `@solana/web3.js` · `ws` · `axios`

### Quick Start

```bash
cd signal-server
npm install
cp .env.example .env
# Set SOLANA_WSS_URL and API_KEY
npm start
```

For PM2:
```bash
pm2 start src/server.js --name signal-server && pm2 save
```

See [signal-server/README.md](signal-server/README.md) for full documentation, API reference, and troubleshooting.

---

## `trencher-web` — Frontend

Landing page and live platform dashboard for Trencher Agent.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · D3.js v7

### Quick Start

```bash
cd trencher-web
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

### Features

- **Landing page** — pipeline walkthrough, 6 agent layers, 8 feature cards, 3 execution modes, 4 strategy cards, setup docs
- **Platform dashboard** — live D3 force graph (19 nodes · 44 edges), agent roster with live status, real-time activity log stream, agent detail modals
- **D3 animations** — constellation (hero + CTA), force-directed agent graph with particle flows
- **Visual fidelity** — 100% identical to original design; no redesign, no Tailwind rewrites of existing CSS

---

## Getting Started

1. **Start `signal-server`** first — it collects and serves token signals
2. **Start `trencher-core`** — it polls `signal-server` and executes trades
3. **Start `trencher-web`** (optional) — dashboard UI

Make sure `SIGNAL_SERVER_KEY` in `trencher-core/.env` matches `API_KEY` in `signal-server/.env`.

---

## License

MIT
