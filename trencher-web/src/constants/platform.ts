import type {
  PipelineStep,
  FeatureItem,
  ModeCard,
  StrategyCard,
  HeroStat,
} from '@/types';

export const LOG_POOL: [string, string, string][] = [
  ['signal',    'info', 'Polled Pump.fun — 14 new candidates found'],
  ['helius',    'info', 'OnChain: fee-claim 8.3 SOL — PUMP:3xK9m'],
  ['graduated', 'info', 'Graduated token detected: AGT:8nL5xR'],
  ['trending',  'info', 'Jupiter trending: 24 tokens (5m interval)'],
  ['filter',    'info', 'Gates: 5/14 passed — mcap/age/holders OK'],
  ['oracle',    'info', 'Price tick: PUMP:3xK9m $0.000042 +14.3%'],
  ['wallet',    'info', 'Smart money overlap: 3 wallets in PUMP:3xK9m'],
  ['fxtwitter', 'info', 'CT narrative found — bullish sentiment'],
  ['enrich',    'warn', 'GMGN rate limit — backing off 2500ms'],
  ['enrich',    'info', 'GMGN enriched: holders 1240 liq $88k'],
  ['sentiment', 'info', 'Sentiment score: 0.74 (bullish threshold met)'],
  ['strategy',  'info', 'Strategy gates passed: 3/5 candidates'],
  ['risk',      'info', 'Risk check: pos cap 3/3 — gating exec'],
  ['risk',      'warn', 'Bundler rate 0.42 > threshold — pruned 1'],
  ['llm',       'info', 'Batch screening 3 candidates — MiniMax M2.7'],
  ['llm',       'info', 'BUY approved: PUMP:3xK9m — confidence 0.84'],
  ['jup',       'info', 'Jupiter route: 0.15 SOL → PUMP:3xK9m'],
  ['exec',      'info', 'Swap executed: 0.15 SOL → PUMP:3xK9m'],
  ['monitor',   'info', 'Watching 3 positions — TP/SL armed'],
  ['monitor',   'warn', 'PUMP:2rF8 approaching SL — trailing active'],
  ['tg',        'info', 'Alert: Position opened PUMP:3xK9m 0.15 SOL'],
  ['scheduler', 'info', 'Poll cycle triggered — 30s interval'],
  ['orch',      'info', 'Cycle complete — next poll in 30s'],
];

export const MARQUEE_ITEMS: string[] = [
  'Signal Collector', 'LLM Screener', 'Strategy Engine', 'Risk Manager',
  'Jupiter Router', 'Position Monitor', 'GMGN Enrichment', 'Wallet Tracker',
  'Sentiment Agent', 'Telegram Interface', 'Price Oracle', 'Helius Listener',
];

export const HERO_STATS: HeroStat[] = [
  { value: '19', suffix: '×', label: 'Autonomous Agents' },
  { value: '44', suffix: '+', label: 'Data Flow Edges' },
  { value: '6',  suffix: 'L', label: 'Agent Layers' },
  { value: '30', suffix: 's', label: 'Poll Interval' },
];

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    num: '01', icon: 'SIG', color: 'var(--cd)',
    title: 'Signal Ingestion',
    desc: 'Helius, Pump.fun, and Jupiter trending data polled every 30s.',
    items: [
      'Helius WebSocket — fee-claim and graduated token events',
      'Jupiter trending API — volume & swap-ranked tokens (5m interval)',
      'Pump.fun graduated watcher — real-time migration alerts',
      'Scheduler triggers every 30s via cron agent',
      'All candidates stored in candidates SQLite table',
    ],
  },
  {
    num: '02', icon: 'GATE', color: 'var(--ca)',
    title: 'Strategy Gates',
    desc: 'Multi-filter quality gates before any enrichment call.',
    items: [
      'Source count threshold — require ≥N overlapping signals',
      'Token age filter — skip too-new or too-old tokens',
      'Mcap range — min/max market cap in USD',
      'Holder count minimum — exclude thin holder base',
      'ATH distance — % below all-time high window',
      'Bundler rate — reject if >X% of supply in bundled wallets',
    ],
  },
  {
    num: '03', icon: 'ENR', color: 'var(--ce)',
    title: 'Enrichment',
    desc: 'GMGN, Oracle, Wallet tracker, FXTwitter — full context assembly.',
    items: [
      'GMGN API — holders, liquidity, top trader activity',
      'Price Oracle — live price, mcap, 5m/1h/24h delta',
      'Wallet Tracker — cross-reference saved smart-money wallets',
      'FXTwitter — scrape CT narrative around token contract',
      'All enriched data stored in candidates for LLM context',
      '2500ms minimum delay between GMGN calls (rate limit guard)',
    ],
  },
  {
    num: '04', icon: 'LLM', color: 'var(--cx)',
    title: 'LLM Screening',
    desc: 'Batch LLM call selects the best candidate with confidence score.',
    items: [
      'Up to 10 candidates per batch cycle (configurable)',
      'Full enriched context injected per candidate',
      'Default: MiniMax M2.7 — optimized for token analysis prompts',
      'Any OpenAI-compatible endpoint supported',
      'LLM returns: BUY/SKIP decision + confidence score 0–1',
      'Decisions stored in llm_decisions table',
    ],
  },
  {
    num: '05', icon: 'EXE', color: 'var(--cex)',
    title: 'Execution',
    desc: 'Jupiter Ultra swap with auto-slippage and SOL reserve guard.',
    items: [
      'Jupiter Ultra API — best route auto-selection',
      'Slippage managed by Jupiter (no manual config needed)',
      'dry_run: simulated swap saved to SQLite, no wallet',
      'confirm: Telegram Approve/Reject before signing',
      'live: auto-sign and submit after strategy+LLM approval',
      'LIVE_MIN_SOL_RESERVE prevents wallet drain',
    ],
  },
  {
    num: '06', icon: 'MON', color: 'var(--ci)',
    title: 'Position Monitor',
    desc: 'Active TP/SL, trailing TP, partial exits every 10s.',
    items: [
      'Checks all open positions every 10 seconds',
      'Take-profit: closes position when price hits TP%',
      'Stop-loss: exits immediately on SL trigger',
      'Trailing take-profit: locks gains as price rises',
      'Partial TP: sell configurable % at first target',
      'Max hold time: auto-exit after N minutes',
      'Positions survive crash — auto-resume from SQLite',
    ],
  },
];

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    num: '01', title: 'Overlap Detection',
    desc: 'Fee-claim overlap against saved smart-money wallets is the core sniper signal.',
    more: 'Smart money wallets stored via /walletadd. Each candidate is cross-referenced — if N tracked wallets appear in fee-claim events for the same token, it triggers elevated priority. Configure overlap threshold per strategy. Wallet list survives restarts in SQLite.',
  },
  {
    num: '02', title: 'LLM Selection',
    desc: 'Any OpenAI-compatible endpoint. MiniMax M2.7 by default — cheapest for this prompt shape.',
    more: 'Set LLM_BASE_URL and LLM_MODEL in .env. Supports OpenAI, Groq, Ollama (local), MiniMax. One API call per batch — not per candidate. Full enriched context per candidate injected as structured JSON. LLM returns BUY/SKIP with confidence float 0-1 and reasoning string stored in llm_decisions.',
  },
  {
    num: '03', title: 'Multi-Layer Gates',
    desc: 'Source count, age, mcap, holders, ATH distance, bundler rate, rug ratio — all configurable.',
    more: 'Each strategy has its own gate parameters. Change live via /stratset <id> <key> <value>. Gates apply before any GMGN enrichment call — reducing API cost. All gate results logged in filter_results table with pass/fail reason per token per strategy.',
  },
  {
    num: '04', title: 'Jupiter Ultra',
    desc: 'Auto-slippage, best-route aggregation. SOL reserve guard prevents wallet drain.',
    more: 'Jupiter Ultra handles route selection and slippage automatically. Set LIVE_MIN_SOL_RESERVE (default 0.02) to maintain a floor. Partial TP is supported: sell X% at first target, let rest ride. Sell route also uses Jupiter Ultra for best exit price.',
  },
  {
    num: '05', title: 'Trade Lessons',
    desc: '/learn analyzes past positions and generates actionable pattern insights.',
    more: 'Run /learn <30d> to analyze all closed positions. The LLM reviews win/loss patterns, common signals on winning trades, and what to avoid. Results stored in lessons table and retrievable via /lessons. Iterate over time to improve strategy tuning.',
  },
  {
    num: '06', title: 'Crash Resilient',
    desc: 'All state in SQLite. Open positions auto-resume immediately after restart.',
    more: 'Every position, strategy config, wallet, trade intent, and decision is persisted in SQLite before any action. On startup, the monitor agent reads all open positions and resumes watching them. Telegram confirm intents also survive restarts — pending approvals will still process.',
  },
  {
    num: '07', title: 'Telegram Native',
    desc: 'Full strategy config, wallet management, PnL reports via inline Telegram menu.',
    more: 'Commands: /menu /strategy /positions /candidate <mint> /filters /pnl /walletadd /wallets /learn /lessons /stratset. Strategy changes apply in real-time without restart. /candidate <mint> inspects any token by contract address — fetches enriched data on demand.',
  },
  {
    num: '08', title: 'Hot Reload',
    desc: 'Strategy settings change live via /stratset — no restart needed, SQLite is source of truth.',
    more: 'Example: /stratset sniper tp_percent 75 — takes effect immediately on the next cycle. All strategy_configs rows are hot-read per cycle. Switch active strategy via /strategy <id>. Multiple strategies can run concurrently if configured. Toggle LLM on/off per strategy.',
  },
];

export const MODE_CARDS: ModeCard[] = [
  {
    num: 'MODE 01', name: 'dry_run', title: 'Simulate',
    desc: 'Simulated buys and sells stored entirely in SQLite. No wallet needed. Full PnL tracking and position history so you can tune strategy without risking capital.',
    code: 'TRADING_MODE=dry_run\nNo wallet required',
    items: [
      'Requires no Solana private key or Jupiter API key',
      'All buy/sell simulated at oracle price at time of signal',
      'Full position table populated — /positions and /pnl work normally',
      'TP/SL monitor still runs against live price data',
      'Best for: initial strategy tuning before going live',
      'Switch to confirm/live at any time via .env change + restart',
    ],
  },
  {
    num: 'MODE 02', name: 'confirm', title: 'Human Loop',
    featured: true, badge: 'Recommended',
    desc: 'Bot sends a Telegram message with Approve / Reject buttons before every execution. You stay in control while the AI handles the screening work.',
    code: 'TRADING_MODE=confirm\nWallet + Jupiter API required',
    items: [
      'Strategy + LLM must both approve before Telegram prompt',
      'Approve/Reject inline keyboard in Telegram',
      'Trade intent stored in SQLite — survives restart',
      'Timeout: intent expires after configurable minutes if no action',
      'Best for: live trading with manual oversight',
      'Full audit trail in decision_logs table',
    ],
  },
  {
    num: 'MODE 03', name: 'live', title: 'Autonomous',
    desc: 'Signs and submits Jupiter Ultra swaps immediately after strategy and LLM approval. LIVE_MIN_SOL_RESERVE guards the wallet floor.',
    code: 'TRADING_MODE=live\nFull autonomy mode',
    items: [
      'No human approval step — executes within seconds of signal',
      'LIVE_MIN_SOL_RESERVE (default 0.02 SOL) prevents full drain',
      'MAX_OPEN_POSITIONS gate prevents overexposure',
      'All executions still logged in trades + positions tables',
      'Telegram alert sent after every execution',
      'Recommended: test thoroughly in dry_run first',
    ],
  },
];

export const STRATEGY_CARDS: StrategyCard[] = [
  {
    num: '01', name: 'Sniper', color: 'var(--red)',
    desc: 'Aggressive entry on fee-claim overlap signals. LLM-assisted. Fast execution with tight TP.',
    tags: ['Fee-claim overlap primary', 'LLM confidence ≥ 0.70', 'Tight TP, fast exit'],
    params: [
      ['tp_percent', '65'],
      ['sl_percent', '-25'],
      ['llm_min_confidence', '0.70'],
      ['max_mcap', '300,000'],
      ['min_source_count', '2'],
      ['max_hold_minutes', '60'],
    ],
  },
  {
    num: '02', name: 'Dip Buy', color: 'var(--cd)',
    desc: 'Patient strategy. Waits for ATH distance signal then enters on reversal confirmation.',
    tags: ['ATH distance trigger', 'LLM-assisted', 'Wider TP target'],
    params: [
      ['tp_percent', '120'],
      ['sl_percent', '-20'],
      ['llm_min_confidence', '0.65'],
      ['min_ath_distance', '-40%'],
      ['max_hold_minutes', '240'],
      ['partial_tp_percent', '50'],
    ],
  },
  {
    num: '03', name: 'Smart Money', color: 'var(--ca)',
    desc: 'Conservative. Strict holder/trending quality thresholds. Partial TP support.',
    tags: ['Strict holder quality', 'LLM-assisted', 'Partial TP exits'],
    params: [
      ['tp_percent', '85'],
      ['sl_percent', '-15'],
      ['llm_min_confidence', '0.78'],
      ['max_mcap', '500,000'],
      ['min_holders', '800'],
      ['partial_tp_split', '0.5/0.5'],
    ],
  },
  {
    num: '04', name: 'Degen', color: 'var(--cx)',
    desc: 'Pure degen. Low threshold, no LLM. Rule-based only. High risk, high potential.',
    tags: ['No LLM — rule-based only', 'Low source threshold', 'Wide TP, tight SL'],
    params: [
      ['tp_percent', '200'],
      ['sl_percent', '-30'],
      ['llm_enabled', 'false'],
      ['min_source_count', '1'],
      ['max_hold_minutes', '30'],
      ['max_mcap', '150,000'],
    ],
  },
];

export const NAV_LINKS: { href: string; label: string }[] = [
  { href: '#pipeline',   label: 'Pipeline'   },
  { href: '#layers',     label: 'Agents'     },
  { href: '#features',   label: 'Features'   },
  { href: '#modes',      label: 'Modes'      },
  { href: '#strategies', label: 'Strategies' },
  { href: '/guide',      label: 'Docs'       },
  { href: '/burn',       label: 'Burn'       },
  { href: '/verify',     label: 'Verify Holder' },
];

export const FOOTER_LINKS: { href: string; label: string; onClick?: boolean }[] = [
  { href: '#', label: 'Platform', onClick: true },
  { href: '#pipeline',   label: 'Pipeline'   },
  { href: '#layers',     label: 'Agents'     },
  { href: '#strategies', label: 'Strategies' },
  { href: '#config',     label: 'Docs'       },
];
