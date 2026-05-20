import type { LayerColor, SidebarLayer } from '@/types';

export const LC: Record<string, LayerColor> = {
  core:     { fill: '#111827', stroke: '#111827', text: '#FFFFFF', grad: '#374151' },
  data:     { fill: '#DBEAFE', stroke: '#1D4ED8', text: '#1E3A8A', grad: '#2563EB' },
  enrich:   { fill: '#EDE9FE', stroke: '#6D28D9', text: '#4C1D95', grad: '#7C3AED' },
  analysis: { fill: '#DCFCE7', stroke: '#15803D', text: '#14532D', grad: '#16A34A' },
  decision: { fill: '#FEF3C7', stroke: '#B45309', text: '#78350F', grad: '#D97706' },
  exec:     { fill: '#FEE2E2', stroke: '#B91C1C', text: '#7F1D1D', grad: '#DC2626' },
  iface:    { fill: '#E2E8F0', stroke: '#334155', text: '#0F172A', grad: '#475569' },
};

export const LAYER_DATA: Record<string, {
  title: string;
  agents: string[];
  desc: string;
  details: [string, string][];
}> = {
  data: {
    title: 'Data Ingestion Layer',
    agents: ['Helius Listener', 'Signal Collector', 'Trending Indexer', 'Graduated Watcher'],
    desc: 'The data ingestion layer is responsible for polling all external data sources at configured intervals. Helius provides real-time on-chain WebSocket events. The Signal Collector aggregates all incoming candidates. Trending Indexer polls Jupiter API every 60s. The Graduated Watcher monitors Pump.fun token graduation events continuously.',
    details: [
      ['Poll Interval', '30s default (configurable)'],
      ['Helius WebSocket', 'Fee-claim + graduated events'],
      ['Jupiter Trending', 'Volume & swap ranked tokens'],
      ['Max Candidates/Cycle', 'Configurable via SIGNAL_POLL_MS'],
      ['Storage', 'candidates SQLite table'],
    ],
  },
  enrich: {
    title: 'Enrichment Layer',
    agents: ['GMGN Worker', 'Price Oracle', 'Wallet Tracker', 'FXTwitter Narrative'],
    desc: 'Enrichment agents assemble full context for each candidate before LLM screening. GMGN provides holder quality data. The Price Oracle fetches live price, mcap, and delta data. Wallet Tracker cross-references against saved smart-money wallets. FXTwitter scrapes CT narrative for the token contract.',
    details: [
      ['GMGN Delay', '2500ms minimum (rate limit)'],
      ['Oracle Source', 'Jupiter + Helius price feeds'],
      ['Wallet Storage', 'saved_wallets SQLite table'],
      ['FXTwitter', 'CT narrative extraction'],
      ['Context output', 'Structured JSON per candidate'],
    ],
  },
  analysis: {
    title: 'Analysis Layer',
    agents: ['Filter Gate', 'Strategy Engine', 'Risk Manager', 'Sentiment Agent'],
    desc: 'The analysis layer applies all rule-based logic before any LLM call. Filter Gate applies per-strategy configurable gates. Strategy Engine scores candidates and applies additional filters. Risk Manager checks position caps, bundler rates, and rug ratios. Sentiment Agent scores CT narrative and wallet overlap quality.',
    details: [
      ['Gate params', 'Per-strategy, hot-reloadable'],
      ['Risk check', 'Position cap + bundler rate + rug ratio'],
      ['Sentiment score', '0–1 float, injected to LLM context'],
      ['Gate results', 'Stored in filter_results table'],
      ['Hot reload', 'Via /stratset Telegram command'],
    ],
  },
  decision: {
    title: 'Decision Layer',
    agents: ['LLM Screener'],
    desc: 'The LLM Screener receives a batch of fully enriched candidates and selects the best BUY opportunity per cycle. It uses any OpenAI-compatible endpoint — MiniMax M2.7 by default for cost efficiency. The LLM receives structured JSON per candidate including price data, holder quality, CT sentiment, and risk scores.',
    details: [
      ['Default model', 'MiniMax M2.7'],
      ['Candidates/batch', 'Up to 10 (LLM_CANDIDATE_PICK_COUNT)'],
      ['Output', 'BUY/SKIP + confidence float 0–1'],
      ['Storage', 'llm_decisions + llm_batches tables'],
      ['Timeout', '60s default (LLM_TIMEOUT_MS)'],
    ],
  },
  exec: {
    title: 'Execution Layer',
    agents: ['Jupiter Router', 'Execution Engine', 'Position Monitor'],
    desc: 'Execution agents handle everything from approved signal to active position management. Jupiter Router selects the optimal swap route. Execution Engine signs and submits the transaction. Position Monitor checks all open positions every 10 seconds and fires TP/SL/trailing exit logic.',
    details: [
      ['Swap routing', 'Jupiter Ultra API'],
      ['Position check', 'Every 10s (POSITION_CHECK_MS)'],
      ['Supported exits', 'TP, SL, trailing TP, partial TP, max hold'],
      ['State', 'All positions in SQLite — crash resilient'],
      ['Live reserve', 'LIVE_MIN_SOL_RESERVE guard'],
    ],
  },
  iface: {
    title: 'Interface Layer',
    agents: ['Telegram Interface', 'Scheduler Agent'],
    desc: 'Interface agents handle all human-facing interaction and polling cycle timing. The Telegram Interface processes all commands and sends alerts. The Scheduler Agent triggers polling cycles at configured intervals, dispatching signals to the Signal Collector.',
    details: [
      ['Commands', '20+ Telegram commands available'],
      ['Alert types', 'Position open/close, TP/SL hit, risk gate'],
      ['Scheduler interval', '30s default (SIGNAL_POLL_MS)'],
      ['Mode support', 'confirm mode Approve/Reject buttons'],
      ['Strategy control', '/stratset hot-reloads params live'],
    ],
  },
};

export const SIDEBAR_LAYERS: SidebarLayer[] = [
  { k: 'data',     n: 'Data Ingestion', c: LC.data.stroke,     cnt: 4 },
  { k: 'enrich',   n: 'Enrichment',     c: LC.enrich.stroke,   cnt: 4 },
  { k: 'analysis', n: 'Analysis',       c: LC.analysis.stroke, cnt: 4 },
  { k: 'decision', n: 'Decision',       c: LC.decision.stroke, cnt: 1 },
  { k: 'exec',     n: 'Execution',      c: LC.exec.stroke,     cnt: 3 },
  { k: 'iface',    n: 'Interface',      c: LC.iface.stroke,    cnt: 2 },
];
