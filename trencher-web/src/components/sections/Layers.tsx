'use client';

import { LAYER_DATA } from '@/constants/layers';

const LAYER_CARDS = [
  {
    key: 'data',
    className: 'lc-data',
    num: 'Layer 01',
    heading: 'Data Ingestion',
    sub: 'On-chain event listeners, signal aggregators, and trend indexers feeding raw candidates.',
    tags: ['Helius Listener', 'Signal Collector', 'Trending Indexer', 'Grad Watcher'],
    agentCount: '4 agents',
  },
  {
    key: 'enrich',
    className: 'lc-enrich',
    num: 'Layer 02',
    heading: 'Enrichment',
    sub: 'GMGN holder data, price oracle feeds, wallet overlap tracking, CT narrative.',
    tags: ['GMGN Worker', 'Price Oracle', 'Wallet Tracker', 'FXTwitter'],
    agentCount: '4 agents',
  },
  {
    key: 'analysis',
    className: 'lc-analysis',
    num: 'Layer 03',
    heading: 'Analysis',
    sub: 'Strategy gate engine, risk manager, sentiment scorer, and filter gate working in parallel.',
    tags: ['Filter Gate', 'Strategy Engine', 'Risk Manager', 'Sentiment Agent'],
    agentCount: '4 agents',
  },
  {
    key: 'decision',
    className: 'lc-decision',
    num: 'Layer 04',
    heading: 'Decision',
    sub: 'LLM screener batches candidates with full context and picks the best BUY per cycle.',
    tags: ['LLM Screener', 'MiniMax M2.7', 'OpenAI-compat'],
    agentCount: '1 agent',
  },
  {
    key: 'exec',
    className: 'lc-exec',
    num: 'Layer 05',
    heading: 'Execution',
    sub: 'Jupiter router, execution engine, and position monitor — signal to on-chain swap and active watch.',
    tags: ['Jupiter Router', 'Execution Engine', 'Position Monitor'],
    agentCount: '3 agents',
  },
  {
    key: 'iface',
    className: 'lc-iface',
    num: 'Layer 06',
    heading: 'Interface',
    sub: 'Telegram bot and scheduler handle all human interaction and polling cycle timing.',
    tags: ['Telegram Interface', 'Scheduler Agent'],
    agentCount: '2 agents',
  },
];

interface LayersProps {
  onOpenModal: (key: string) => void;
}

export function Layers({ onOpenModal }: LayersProps) {
  return (
    <section id="layers">
      <div className="wrap">
        <div className="layers-hd">
          <div>
            <div className="sec-label">Architecture</div>
            <h2 className="sec-h2">19 Agents.<br />6 Layers.</h2>
          </div>
          <p className="sec-body" style={{ alignSelf: 'end' }}>
            Click any layer to see the full agent breakdown. Each layer communicates through a dense
            44-edge directed graph, all coordinated by the Orchestrator.
          </p>
        </div>
        <div className="layers-grid">
          {LAYER_CARDS.map(card => (
            <div
              key={card.key}
              className={`layer-card ${card.className}`}
              onClick={() => onOpenModal(card.key)}
            >
              <span className="lc-num">{card.num}</span>
              <div className="lc-dot" />
              <div className="lc-h">{card.heading}</div>
              <p className="lc-sub">{card.sub}</p>
              <div className="lc-agents">
                {card.tags.map(tag => (
                  <span key={tag} className="lc-tag">{tag}</span>
                ))}
              </div>
              <div className="layer-detail-bar">
                <span>{card.agentCount}</span>
                <span>→ View details</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
