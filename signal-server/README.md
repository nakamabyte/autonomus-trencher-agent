# Signal Server

Independent signal aggregation service for Trencher Agent. Collects token data from multiple on-chain and off-chain sources, merges them into unified signals, and serves them via a REST API that `trencher-core` polls periodically.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 signal-server                    │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  Graduated    │  │  Trending    │              │
│  │  (Pump.fun)   │  │  (Jupiter)   │              │
│  │  poll / 30s   │  │  poll / 60s  │              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                      │
│         ▼                  ▼                      │
│  ┌─────────────────────────────────┐             │
│  │     In-Memory Signal Store      │             │
│  │   (merged by mint, TTL: 10m)    │◄────────┐   │
│  └──────────────┬──────────────────┘         │   │
│                 │                             │   │
│                 ▼                             │   │
│  ┌──────────────────────┐   ┌────────────┐   │   │
│  │  GET /api/signals     │   │ Fee Claim  │   │   │
│  │  (Express + Auth)     │   │ (Solana WS)│───┘   │
│  └──────────┬───────────┘   └────────────┘       │
└─────────────┼────────────────────────────────────┘
              │
              ▼
       trencher-core
       (HTTP polling)
```

### Data Sources

| Source | Method | Interval | Data |
|---|---|---|---|
| **Graduated** | HTTP poll → `pump.fun/coins/graduated` | 30s | Recently graduated coins with ATH distance |
| **Trending** | HTTP poll → `jup.ag/tokens/v2/toptrending` | 60s | Top trending tokens with price, volume, buys/sells |
| **Fee Claim** | Solana WebSocket → `logsSubscribe` | Real-time | Dev fee claim events (distributed SOL, shareholders) |

### Signal Merging

When the same `mint` appears across multiple sources (e.g., a token is both graduated and trending), the server merges them into a single signal object with an incremented `sourceCount`. `trencher-core` uses `sourceCount` and `sources[]` to route and filter candidates.

---

## Quick Start

```bash
cd signal-server
npm install
cp .env.example .env   # or edit .env directly
npm start
```

---

## Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port. Default: `4000` |
| `API_KEY` | Yes | Secret key for API authentication. Must match `SIGNAL_SERVER_KEY` in `trencher-core/.env` |
| `SOLANA_WSS_URL` | Yes | Solana WebSocket RPC URL (Helius or QuickNode). Required for real-time fee claim detection |
| `JUPITER_API_KEY` | No | Jupiter API key for higher rate limits on trending endpoint |

Example `.env`:

```env
PORT=4000
API_KEY=your_secret_key_here

# Solana WebSocket RPC (Helius/QuickNode)
SOLANA_WSS_URL=wss://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY

# Optional: Jupiter API key for higher rate limits
JUPITER_API_KEY=
```

---

## Running

### Development

```bash
npm start
```

### Production (PM2)

```bash
# Install PM2 globally (if not installed)
npm install -g pm2

# Start the server
pm2 start src/server.js --name signal-server

# Persist across reboots
pm2 save
pm2 startup

# View logs
pm2 logs signal-server

# Restart / Stop
pm2 restart signal-server
pm2 stop signal-server
```

### Expected Startup Output

```
[ws] connecting to wss://mainnet.helius-rpc.com/?api-key=...
[ws] connected
[graduated] loaded 30
[trending] loaded 85
[scraper] running — graduated every 30s, trending every 60s
[signal-server] listening on :4000
```

---

## API Reference

### `GET /api/signals`

Returns aggregated token signals. This is the endpoint polled by `trencher-core`.

**Headers:**

| Header | Value |
|---|---|
| `x-api-key` | Your `API_KEY` value |

**Query Parameters:**

| Param | Default | Description |
|---|---|---|
| `limit` | `100` | Max number of signals to return |
| `minSources` | `1` | Minimum `sourceCount` filter (trencher-core sends `2`) |

**Example Request:**

```bash
curl -H 'x-api-key: your_secret_key' \
  'http://localhost:4000/api/signals?limit=50&minSources=2'
```

**Example Response:**

```json
{
  "signals": [
    {
      "mint": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuZaVpump",
      "sources": ["graduated", "trending", "fee_claim"],
      "sourceCount": 3,
      "ageMs": 120000,
      "name": "Example Token",
      "symbol": "EXT",
      "priceUsd": 0.00012,
      "marketCapUsd": 120000,
      "liquidityUsd": 35000,
      "holders": 150,
      "volume24h": 450000,
      "volume5m": 12000,
      "graduated": {
        "distanceFromAthPercent": -15.5
      },
      "trending": {
        "buys": 250,
        "sells": 120
      },
      "feeClaim": {
        "distributedSol": 5.0,
        "signature": "5zJ...8xQ",
        "shareholders": [
          { "address": "Wallet1...", "bps": 5000 },
          { "address": "Wallet2...", "bps": 5000 }
        ]
      }
    }
  ]
}
```

### `GET /health`

Health check endpoint (no auth required).

```bash
curl http://localhost:4000/health
# {"status":"ok","uptime":3600}
```

---

## Connecting to Trencher Core

Add these two lines to `trencher-core/.env`:

```env
SIGNAL_SERVER_URL=http://localhost:4000
SIGNAL_SERVER_KEY=your_secret_key_here
```

> **Important:** Do NOT append `/api/signals` to the URL — `trencher-core` adds it automatically.

Then restart trencher-core:

```bash
pm2 restart trencher-agent
```

If running on a VPS, replace `localhost` with your server's IP address:

```env
SIGNAL_SERVER_URL=http://123.45.67.89:4000
```

---

## Project Structure

```
signal-server/
├── .env              # Configuration (secrets, port, RPC URL)
├── .gitignore
├── package.json
└── src/
    ├── server.js     # Express API + auth middleware + health check
    └── scraper.js    # Data collection (graduated, trending, fee claims)
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `[graduated] loaded 0` | Pump.fun API down or rate-limited | Wait and retry; will auto-poll again in 30s |
| `[trending] loaded 0` | Jupiter API rate limit or no API key | Set `JUPITER_API_KEY` in `.env` |
| `[ws] error: connect ECONNREFUSED` | Invalid `SOLANA_WSS_URL` | Check your Helius/QuickNode WSS URL |
| `[ws] closed, reconnecting in 5s` | WebSocket disconnected | Auto-reconnect; check RPC provider status |
| `trencher-core` gets `401 Unauthorized` | API key mismatch | Ensure `API_KEY` here matches `SIGNAL_SERVER_KEY` in `trencher-core/.env` |
| Signals return empty `[]` | `minSources` too high or all signals expired | Lower `minSources` query param or check scraper logs |
