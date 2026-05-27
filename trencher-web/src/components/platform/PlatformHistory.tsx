'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

// Taglines based on exit reason and PnL
function tagline(isWin: boolean, exitReason: string | null): string {
  if (isWin) {
    if (exitReason === 'TRAILING_TP') return 'Perfect timing! 🎯';
    if (exitReason === 'TP') return 'Target hit! ✅';
    return 'Sniped it! 🔥';
  }
  if (exitReason === 'SL') return 'Cut the loss. 🛡️';
  return 'Next one. 🔄';
}

function PnlModal({ pos, onClose }: { pos: ClosedPos; onClose: () => void }) {
  const isWin = pos.pnl_percent >= 0;
  const sign = isWin ? '+' : '';
  const accentColor = isWin ? '#00E87A' : '#FF4D4D';
  const exitLabel = pos.exit_reason ? (EXIT_LABELS[pos.exit_reason] || pos.exit_reason) : '—';
  const holdStr = pos.closed_at_ms && pos.opened_at_ms
    ? holdTime(pos.opened_at_ms, pos.closed_at_ms) : '—';
  const tLine = tagline(isWin, pos.exit_reason);

  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `trencher-${pos.symbol}-${sign}${pos.pnl_percent.toFixed(1)}pct.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Screenshot failed', e);
    }
    setSharing(false);
  }, [pos, sign, sharing]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `trencher-pnl-${pos.symbol}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `$${pos.symbol} ${sign}${pos.pnl_percent.toFixed(2)}% | Trencher Agent` });
        } else {
          // Fallback: just download
          const link = document.createElement('a');
          link.download = file.name;
          link.href = URL.createObjectURL(blob);
          link.click();
        }
        setSharing(false);
      }, 'image/png');
    } catch (e) {
      console.error('Share failed', e);
      setSharing(false);
    }
  }, [pos, sign, sharing]);

  const content = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}
        onClick={e => e.stopPropagation()}>

        {/* ─── CARD (the shareable image) ─── */}
        <div
          ref={cardRef}
          style={{
            /* Portrait card — 400×520 like Axiom */
            width: '400px',
            height: '520px',
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            fontFamily: "'Barlow Condensed', sans-serif",
            userSelect: 'none',
          }}
        >
          {/* Background: full-bleed logo image */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'url(/logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 10%',
          }} />

          {/* Dark overlay gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.82) 55%, rgba(0,0,0,0.95) 100%)',
          }} />

          {/* Accent glow in corner */}
          <div style={{
            position: 'absolute', top: '-80px', right: '-80px',
            width: '280px', height: '280px', borderRadius: '50%',
            background: `${accentColor}18`,
            filter: 'blur(40px)',
          }} />

          {/* ── CONTENT ── */}
          <div style={{
            position: 'relative', zIndex: 2,
            height: '100%', display: 'flex', flexDirection: 'column',
            padding: '22px 24px',
          }}>

            {/* Row 1: Logo mark + Brand name */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              {/* Logo icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/logo.png" alt="logo"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${accentColor}66` }}
                />
              </div>
              {/* Brand */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                  TRENCHER
                </span>
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.55)', marginLeft: '3px' }}>
                  Agent
                </span>
              </div>
            </div>

            {/* Row 2: Token symbol */}
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '14px' }}>
              {pos.symbol}
            </div>

            {/* Row 3: Big PnL SOL badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              background: accentColor,
              borderRadius: '8px',
              padding: '10px 18px',
              marginBottom: '24px',
              width: 'fit-content',
            }}>
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <circle cx="3" cy="7" r="3" fill="#000" opacity="0.6"/>
                <circle cx="9" cy="7" r="3" fill="#000" opacity="0.6"/>
                <circle cx="15" cy="7" r="3" fill="#000" opacity="0.6"/>
              </svg>
              <span style={{ fontSize: '34px', fontWeight: 900, color: '#000', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {sign}{pos.pnl_sol.toFixed(3)}
              </span>
            </div>

            {/* Row 4: Stats table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {([
                ['PNL', `${sign}${pos.pnl_percent.toFixed(2)}%`, accentColor],
                ['Invested', `${pos.size_sol.toFixed(3)} SOL`, '#9945FF'],
                ['Position', `${(pos.size_sol + pos.pnl_sol).toFixed(3)} SOL`, '#9945FF'],
                ['Strategy', (pos.strategy || 'SNIPER').toUpperCase(), 'rgba(255,255,255,0.5)'],
                ['Entry MCap', formatMcap(pos.entry_mcap), 'rgba(255,255,255,0.5)'],
                ['Hold', holdStr, 'rgba(255,255,255,0.5)'],
                ['Exit', exitLabel, 'rgba(255,255,255,0.5)'],
              ] as [string, string, string][]).map(([label, val, color]) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                }}>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>{label}</span>
                  <span style={{ fontSize: '15px', color, fontWeight: 700, letterSpacing: label === 'Strategy' ? '0.06em' : undefined }}>
                    {label === 'Invested' || label === 'Position'
                      ? <><span style={{ color: '#9945FF', fontSize: '12px', marginRight: '3px' }}>◎</span>{val.replace(' SOL','')}</>
                      : val}
                  </span>
                </div>
              ))}
            </div>

            {/* Row 5: Tagline */}
            <div style={{ marginTop: '20px', marginBottom: '12px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                {tLine}
              </span>
            </div>

            {/* Row 6: Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                🌐 trencher-agent.vercel.app
              </span>
              {pos.exit_signature && (
                <span style={{ fontSize: '12px', color: accentColor, opacity: 0.8 }}>
                  🔗 {pos.exit_signature.slice(0, 6)}...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── ACTION BUTTONS (outside card, not included in screenshot) ─── */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleDownload}
            disabled={sharing}
            style={{
              padding: '10px 22px', borderRadius: '8px', border: 'none',
              background: accentColor, color: '#000',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: sharing ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {sharing ? 'Processing...' : '⬇ Download PNG'}
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              padding: '10px 22px', borderRadius: '8px',
              border: `1px solid ${accentColor}55`, background: 'transparent',
              color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: sharing ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {sharing ? '...' : '↗ Share'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              color: 'rgba(255,255,255,0.45)', fontSize: '13px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
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
                  title="Click to view & share PnL card"
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
