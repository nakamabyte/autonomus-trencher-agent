'use client';

import { useRef, useEffect } from 'react';
import { useConsciousnessStream, type ConsciousnessDecision } from '@/hooks/useConsciousnessStream';

// ─── Color tokens ─────────────────────────────────────────────────
const VERDICT_COLOR: Record<string, string> = {
  BUY:      '#00C896',
  ESCALATE: '#FFB347',
  SKIP:     '#FF6B6B',
};

const VERDICT_LABEL: Record<string, string> = {
  BUY:      '● BUY',
  ESCALATE: '◐ ESCALATE',
  SKIP:     '○ SKIP',
};

const TIER_COLOR: Record<string, string> = {
  T1: '#4FC3F7',
  T2: '#CE93D8',
};

// ─── Sub-components ───────────────────────────────────────────────
function StatsBar({
  stats,
  connected,
}: {
  stats: ReturnType<typeof useConsciousnessStream>['stats'];
  connected: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '6px 12px',
      borderBottom: '1px solid #1a1a24',
      fontSize: '10px', fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Connection indicator */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? '#00C896' : '#555',
          boxShadow: connected ? '0 0 6px #00C896' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ color: connected ? '#00C896' : '#555' }}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </span>

      <span style={{ color: '#444' }}>|</span>

      <span style={{ color: '#aaa' }}>Total: <strong style={{ color: '#ddd' }}>{stats.total}</strong></span>
      <span style={{ color: '#00C896' }}>BUY: <strong>{stats.buys}</strong></span>
      <span style={{ color: '#FFB347' }}>ESC: <strong>{stats.escalates}</strong></span>
      <span style={{ color: '#FF6B6B' }}>SKIP: <strong>{stats.skips}</strong></span>
    </div>
  );
}

function DecisionRow({ d }: { d: ConsciousnessDecision }) {
  const verdictColor = VERDICT_COLOR[d.verdict] || '#888';
  const rowBg = d.verdict === 'BUY'
    ? 'rgba(0,200,150,0.04)'
    : d.verdict === 'ESCALATE'
    ? 'rgba(255,179,71,0.04)'
    : 'transparent';

  return (
    <div style={{
      padding: '5px 12px',
      borderBottom: '1px solid #111',
      backgroundColor: rowBg,
      fontSize: '10px',
      fontFamily: "'JetBrains Mono', monospace",
      lineHeight: '1.6',
    }}>
      {/* Row 1: timestamp | agent | tier | symbol | verdict */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: '#444', minWidth: 56 }}>{d.timestamp}</span>
        {d.strategy && (
          <span style={{
            color: '#888',
            fontSize: '9px',
            background: 'rgba(255,255,255,0.05)',
            padding: '1px 4px',
            borderRadius: '2px',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {d.agent_name || d.strategy}
          </span>
        )}
        <span style={{
          color: TIER_COLOR[d.tier] || '#888',
          fontSize: '9px',
          border: `1px solid ${TIER_COLOR[d.tier] || '#888'}`,
          padding: '0 4px',
          borderRadius: 2,
          opacity: 0.8,
        }}>
          {d.tier}
        </span>
        <span style={{ color: '#fff', fontWeight: 700, letterSpacing: '.03em' }}>{d.symbol}</span>
        {d.runner_signal && (
          <span style={{ color: '#00BBF9', fontSize: '9px' }}>{d.runner_signal}</span>
        )}
        {d.kol_signal && (
          <span style={{ color: '#CE93D8', fontSize: '9px' }}>KOL:{d.kol_signal}</span>
        )}
        <span style={{ color: verdictColor, fontWeight: 700, marginLeft: 'auto' }}>
          {VERDICT_LABEL[d.verdict]}
        </span>
      </div>

      {/* Row 2: metrics */}
      <div style={{ display: 'flex', gap: '12px', color: '#555', marginTop: '1px' }}>
        <span>
          conf: <span style={{ color: d.confidence >= 0.8 ? '#00C896' : d.confidence >= 0.75 ? '#FFB347' : '#aaa' }}>
            {d.confidence.toFixed(2)}
          </span>
        </span>
        <span>
          rug: <span style={{ color: d.rug_probability > 20 ? '#FF6B6B' : '#888' }}>
            {d.rug_probability}%
          </span>
        </span>
        {d.smart_money_overlap > 0 && (
          <span style={{ color: '#00C896' }}>sm:{d.smart_money_overlap}</span>
        )}
        {d.entry_mcap && d.verdict === 'BUY' && (
          <span style={{ color: '#00C896' }}>${Math.round(d.entry_mcap / 1000)}K</span>
        )}
      </div>

      {/* Row 3: reason (only for SKIP/ESCALATE) */}
      {(d.verdict === 'SKIP' || d.verdict === 'ESCALATE') && d.reason && (
        <div style={{ color: '#444', fontSize: '9px', marginTop: '1px', fontStyle: 'italic' }}>
          ↳ {d.reason}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export function ConsciousnessStream({ strategyFilter }: { strategyFilter?: string } = {}) {
  const { decisions, connected, stats } = useConsciousnessStream({ 
    maxDecisions: strategyFilter ? 100 : 30,
    agentId: strategyFilter
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest) on new decision
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [decisions.length]);

  const filtered = strategyFilter ? decisions.filter(d => d.strategy === strategyFilter) : [];
  const displayDecisions = strategyFilter ? filtered.slice(0, 30) : decisions;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0a0a0f',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid #1a1a24',
        fontSize: '9px',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: '#00C896',
      }}>
        Proof of Consciousness — Agent Thinking Feed
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} connected={connected} />

      {/* Decision feed */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {displayDecisions.length === 0 ? (
          <div style={{
            padding: '24px 12px',
            color: '#333',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: 'center',
          }}>
            {connected ? 'No recent decisions. Agent is actively scanning the market...' : 'Connecting to agent stream...'}
          </div>
        ) : (
          displayDecisions.map((d, i) => (
            <DecisionRow key={`${d.timestamp}-${d.mint}-${i}`} d={d} />
          ))
        )}
      </div>
    </div>
  );
}
