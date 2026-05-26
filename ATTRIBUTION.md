# Attribution

Trencher Agent is built on top of [Charon](https://github.com/yunus-0x/charon)
by [@yunus-0x](https://github.com/yunus-0x).

Charon is a Telegram trench agent for screening Pump.fun token flow on Solana.
Trencher Agent forks Charon's core pipeline and extends it significantly with
original features listed below.

---

## Files Derived from Charon

The following files in `trencher-core/src/` are based on or derived from Charon:

| File | Origin |
|---|---|
| `pipeline/orchestrator.js` | yunus-0x/charon |
| `pipeline/candidateBuilder.js` | yunus-0x/charon |
| `enrichment/jupiter.js` | yunus-0x/charon |
| `enrichment/gmgn.js` | yunus-0x/charon |
| `execution/router.js` | yunus-0x/charon |
| `execution/liveExecutor.js` | yunus-0x/charon |
| `telegram/commands.js` | yunus-0x/charon |
| `telegram/menus.js` | yunus-0x/charon |
| `db/connection.js` | yunus-0x/charon |
| `signals/collector.js` | yunus-0x/charon |
| `filters/gate.js` | yunus-0x/charon |

---

## Original Contributions by Trencher Agent

The following are original features written from scratch for this project
and do not exist in the upstream Charon codebase:

### trencher-web/ (100% original)
Full Next.js + TypeScript web dashboard including:
- Real-time position monitoring panel
- Closed positions history component
- D3.js performance visualization
- Strategy configuration UI
- Multi-LLM status panel

### trencher-core/src/agents/ (original additions)
- `kol-monitor.js` — Trusted KOL signal detection via FXTwitter scraping
- `llmScreener.js` — 3-tier LLM cascade architecture (not present in Charon)

### trencher-core/src/config/ (original)
- `kol-list.js` — Trusted KOL handle registry with metadata

### trencher-core/src/utils/ (original)
- `llm-prompt-builder.js` — Dynamic LLM prompt construction with KOL signal injection

### Multi-LLM Cascade Architecture (original design)
Charon uses a single LLM for screening. Trencher Agent replaces this with
a 3-tier cascade:
- Tier 1: DeepSeek-chat (bulk fast screening, ~90% of traffic)
- Tier 2: Grok (KOL signal validation + CT narrative analysis, ~10% of traffic)
- Tier 3: Claude Sonnet (post-hoc trade analysis for /learn and /lessons commands only)

### Trusted KOL Signal System (original)
A KOL boost system that detects posts from verified trusted CT accounts
and applies weighted confidence adjustments before execution decisions.

---

## Upstream License Status

As of the time of this writing, yunus-0x/charon does not carry an explicit
open source license in the repository. We have made good-faith efforts to
attribute the upstream source clearly. Trencher Agent's original contributions
(listed above) are released under the MIT License.

If you are the maintainer of yunus-0x/charon and have concerns about this
usage, please open an issue or contact us directly.

---

## Third-Party Dependencies

This project uses the following major open source packages:

| Package | License |
|---|---|
| better-sqlite3 | MIT |
| node-telegram-bot-api | MIT |
| openai (npm) | MIT |
| @anthropic-ai/sdk | MIT |
| @solana/web3.js | MIT |
| next.js | MIT |
| react | MIT |
| d3 | ISC |

Full dependency list: see `package.json` in each submodule.

---

*Trencher Agent is not affiliated with or endorsed by the original Charon project.*
