# Trencher Agent

> AI-powered Solana trench orchestrator. 19 autonomous agents — signal ingestion, LLM screening, Jupiter execution, Telegram control.

⚠️ **Codebase is in testing period. Developer does not guarantee any result.**

---

## Repository Structure

```
trencher-agent/
├── ta-fe/   # Frontend — Next.js 16 · React 19 · TypeScript · Tailwind CSS v4
└── ta-be/   # Backend  — Node.js · SQLite · Telegram Bot · Jupiter Ultra
```

---

## `ta-be` — Backend Service

The core agent orchestrator. Monitors Pump.fun token flow, enriches candidates, screens via LLM, and executes via Jupiter Ultra.

**Stack:** Node.js (ESM) · `better-sqlite3` · `node-telegram-bot-api` · `@solana/web3.js` v1 · `ws`

### Quick Start

```bash
cd ta-be
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

# Signal server (required — contact maintainer for key)
SIGNAL_SERVER_URL=https://api.thecharon.xyz/api
SIGNAL_SERVER_KEY=

# Solana RPC
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=

# Execution mode: dry_run | confirm | live
TRADING_MODE=dry_run

# LLM (any OpenAI-compatible endpoint)
ENABLE_LLM=true
LLM_BASE_URL=https://api.minimax.io/v1
LLM_API_KEY=
LLM_MODEL=MiniMax-M2.7

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

## `ta-fe` — Frontend

Landing page and live platform dashboard for Trencher Agent.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · D3.js v7

### Quick Start

```bash
cd ta-fe
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

## Getting Access

Trencher Agent requires a **Signal Server Key** to receive real-time Pump.fun token flow.

Contact the maintainer to get your `SIGNAL_SERVER_KEY`. Without it, the backend has no candidates to screen.

---

## License

MIT
