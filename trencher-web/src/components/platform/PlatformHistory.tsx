'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PlatformMetrics } from '@/types';

type ClosedPos = NonNullable<PlatformMetrics['closed_positions']>[0];

interface PlatformHistoryProps {
  metrics: PlatformMetrics;
  rightOffset?: number;
  logHeight: number;
}

function formatMcap(mcap: number | null) {
  if (!mcap) return 'N/A';
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`;
  return `$${mcap}`;
}

function holdTime(openMs: number, closeMs: number) {
  const diff = Math.round((closeMs - openMs) / 60000);
  if (diff < 60) return `${diff}m`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

const EXIT_LABELS: Record<string, string> = {
  SL: 'Stop Loss',
  TP: 'Take Profit',
  TRAILING_TP: 'Trailing TP',
  MAX_HOLD: 'Max Hold',
  FORCE_CLOSE_FUNDS: 'Force Close',
  MANUAL: 'Manual',
};

function PnlModal({ pos, onClose }: { pos: ClosedPos; onClose: () => void }) {
  const isWin = pos.pnl_percent >= 0;
  const sign = isWin ? '+' : '';
  const accentColor = isWin ? '#4ADE80' : '#F87171';
  const exitLabel = pos.exit_reason ? (EXIT_LABELS[pos.exit_reason] || pos.exit_reason) : '—';
  const holdStr = pos.closed_at_ms && pos.opened_at_ms ? holdTime(pos.opened_at_ms, pos.closed_at_ms) : '—';

  const rows: [string, React.ReactNode][] = [
    ['PNL', <span key="pnl" style={{ color: accentColor, fontWeight: 700 }}>{sign}{pos.pnl_percent.toFixed(2)}%</span>],
    ['Invested', <span key="inv" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ color: '#9945FF', fontSize: '10px' }}>◎</span>{pos.size_sol.toFixed(3)}</span>],
    ['Position', <span key="pos" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ color: '#9945FF', fontSize: '10px' }}>◎</span>{(pos.size_sol + pos.pnl_sol).toFixed(3)}</span>],
    ['Strategy', <span key="strat" style={{ textTransform: 'uppercase', fontFamily: 'var(--fm)', fontSize: '11px' }}>{pos.strategy || '—'}</span>],
    ['Entry MCap', <span key="mcap">{formatMcap(pos.entry_mcap)}</span>],
    ['Hold Time', <span key="hold">{holdStr}</span>],
    ['Exit', <span key="exit">{exitLabel}</span>],
  ];

  const content = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '340px', borderRadius: '12px', overflow: 'hidden',
          background: '#0c0c0c', border: `1px solid ${accentColor}33`,
          boxShadow: `0 0 60px ${accentColor}22, 0 20px 60px rgba(0,0,0,0.8)`,
          fontFamily: 'var(--ff)',
        }}
      >
        {/* Background logo */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(/logo.png)',
          backgroundSize: 'cover', backgroundPosition: 'center top',
          opacity: 0.15,
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: isWin
            ? 'linear-gradient(135deg, rgba(74,222,128,0.06) 0%, transparent 60%)'
            : 'linear-gradient(135deg, rgba(248,113,113,0.06) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 2, padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', opacity: 0.35, fontFamily: 'var(--fm)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Autonomous Trencher Agent
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                {pos.symbol}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
          </div>

          {/* Big PnL badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '6px', marginBottom: '20px', background: accentColor }}>
            <span style={{ fontSize: '11px', opacity: 0.7, color: '#000' }}>◎</span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>
              {sign}{pos.pnl_sol.toFixed(3)}
            </span>
          </div>

          {/* Stats rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {rows.map(([label, val], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', opacity: 0.45 }}>{label as string}</span>
                <span style={{ fontSize: '13px', color: '#fff' }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Tagline */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              {isWin ? 'Sniped it! 🎯' : 'Next one. 🔄'}
            </span>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', opacity: 0.35, color: '#fff' }}>🌐 trencher-agent.vercel.app</span>
            {pos.exit_signature && (
              <a href={`https://solscan.io/tx/${pos.exit_signature}`} target="_blank" rel="noreferrer"
                style={{ fontSize: '11px', color: 'var(--c-accent)', textDecoration: 'none' }}>
                🔗 Proof
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export function PlatformHistory({ metrics, rightOffset = 16 }: PlatformHistoryProps) {
  const positions = metrics.closed_positions || [];
  const [selectedPos, setSelectedPos] = useState<ClosedPos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div
      className="absolute top-4 z-20 pointer-events-auto flex flex-col"
      style={{ right: `${rightOffset}px`, width: '240px', maxHeight: 'calc(100% - 32px)', background: '#111110', border: '1px solid rgba(255,255,255,.06)', borderRadius: '2px' }}
    >
      <div className="pv-sec flex flex-col flex-1 min-h-0" style={{ borderBottom: 'none' }}>
        <div className="pv-sh" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]"></div>
            HISTORY
          </span>
          <span style={{ color: 'rgba(255,255,255,.15)', fontFamily: 'var(--fm)' }}>{positions.length}</span>
        </div>

        <div className="flex flex-col gap-[2px] mt-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {positions.length === 0 ? (
            <div className="pv-ai" style={{ justifyContent: 'center' }}>
              <span className="pv-ast" style={{ opacity: 0.5 }}>[ NO HISTORY ]</span>
            </div>
          ) : (
            positions.map((pos) => {
              const isProfit = pos.pnl_percent >= 0;
              const colorClass = isProfit ? '#4ADE80' : '#F87171';
              const sign = isProfit ? '+' : '';
              return (
                <div
                  key={pos.id}
                  className="pv-ai"
                  onClick={() => setSelectedPos(pos)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view PnL detail"
                >
                  <div className="pv-adot" style={{ background: colorClass }}></div>
                  <div className="pv-ainfo">
                    <div className="pv-aname" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{pos.symbol}</span>
                        <span style={{ opacity: 0.5, fontFamily: 'var(--fm)', fontSize: '8px' }}>
                          {pos.mint.slice(0, 4)}...{pos.mint.slice(-4)}
                        </span>
                      </span>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_percent.toFixed(2)}%</span>
                    </div>
                    <div className="pv-abar" style={{ background: `${colorClass}22`, height: '2px', marginBottom: '4px' }}>
                      <div className="pv-afill" style={{ width: '100%', background: colorClass }}></div>
                    </div>
                    <div className="pv-ast" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span>MODE: {pos.mode.toUpperCase()}</span>
                      <span suppressHydrationWarning>{new Date(pos.opened_at_ms).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_sol.toFixed(4)} SOL</span>
                    </div>
                    {pos.exit_signature && (
                      <div className="pv-ast" style={{ marginTop: '4px' }}>
                        <a
                          href={`https://solscan.io/tx/${pos.exit_signature}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--c-accent)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          Tx: {pos.exit_signature.slice(0, 8)}...
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {mounted && selectedPos && <PnlModal pos={selectedPos} onClose={() => setSelectedPos(null)} />}
    </div>
  );
}
