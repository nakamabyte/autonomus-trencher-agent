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
    if (exitReason === 'TRAILING_TP') return 'Perfect timing!';
    if (exitReason === 'TP') return 'Target hit!';
    return 'Sniped it!';
  }
  if (exitReason === 'SL') return 'Cut the loss.';
  return 'Next one.';
}

function PnlModal({ pos, onClose }: { pos: ClosedPos; onClose: () => void }) {
  const isWin = pos.pnl_percent >= 0;
  const sign = isWin ? '+' : '';
  const accentColor = isWin ? '#00E87A' : '#FF4D4D';
  const exitLabel = pos.exit_reason ? (EXIT_LABELS[pos.exit_reason] || pos.exit_reason) : '—';
  const holdStr = pos.closed_at_ms && pos.opened_at_ms
    ? holdTime(pos.opened_at_ms, pos.closed_at_ms) : '—';
  const tLine = tagline(isWin, pos.exit_reason);
  const isBase = pos.strategy === 'base_sniper';
  const unit = isBase ? 'ETH' : 'SOL';
  const coinIcon = isBase ? "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" : "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

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
      {/* ─── ACTION BUTTONS (Top Right) ─── */}
      <div
        style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '16px', zIndex: 10000 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={handleDownload} disabled={sharing} title="Download Image" style={{
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', borderRadius: '50%', width: '44px', height: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s', opacity: sharing ? 0.5 : 1
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button onClick={handleShare} disabled={sharing} title="Share" style={{
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', borderRadius: '50%', width: '44px', height: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s', opacity: sharing ? 0.5 : 1
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
        </button>
        <button onClick={onClose} title="Close" style={{
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', borderRadius: '50%', width: '44px', height: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {/* ─── CARD (the shareable image) ─── */}
        <div
          ref={cardRef}
          style={{
            /* Landscape card */
            width: '680px',
            height: '360px',
            position: 'relative',
            borderRadius: '0px',
            border: `2px solid ${accentColor}`,
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
            backgroundPosition: 'center',
          }} />

          {/* Dark overlay gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.88) 50%, rgba(0,0,0,0.98) 100%)',
          }} />

          {/* Accent glow in corner */}
          <div style={{
            position: 'absolute', top: '-100px', right: '-100px',
            width: '400px', height: '400px', borderRadius: '50%',
            background: `radial-gradient(circle, ${accentColor}33 0%, rgba(0,0,0,0) 70%)`,
          }} />

          {/* ── CONTENT ── */}
          <div style={{
            position: 'relative', zIndex: 2,
            height: '100%', display: 'flex', flexDirection: 'column',
            padding: '32px 36px',
          }}>

            {/* Top Row: Brand & Footer info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* Brand */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="/logo.png" alt="logo"
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${accentColor}66` }}
                />
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
                    TRENCHER
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.55)', lineHeight: 1, marginTop: '2px' }}>
                    Autonomous Agent
                  </div>
                </div>
              </div>
              {/* Tagline & Watermark */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {tLine}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
                  autonomustrencheragent.tech
                </div>
              </div>
            </div>

            {/* Middle Row: Main PnL */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: '10px' }}>
              <div>
                <div style={{ fontSize: '46px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '16px' }}>
                  {pos.symbol}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: 'fit-content',
                  background: accentColor,
                  borderRadius: '10px',
                  padding: '12px 20px',
                }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.85)',
                    borderRadius: '50%',
                    width: '40px', height: '40px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}>
                    <img src={coinIcon} width="24" height="24" alt={unit} crossOrigin="anonymous" style={{ objectFit: 'contain' }} />
                  </div>
                  <div style={{ 
                    fontSize: '42px', fontWeight: 900, color: '#000', letterSpacing: '-0.04em', 
                    lineHeight: '40px', height: '40px', display: 'flex', alignItems: 'center' 
                  }}>
                    {sign}{pos.pnl_sol.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Stats grid */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              {([
                ['PNL %', `${sign}${pos.pnl_percent.toFixed(2)}%`, accentColor],
                ['INVESTED', `${pos.size_sol.toFixed(3)} ${unit}`, '#9945FF'],
                ['STRATEGY', (pos.strategy || 'SNIPER').toUpperCase(), '#fff'],
                ['ENTRY MCAP', formatMcap(pos.entry_mcap), '#fff'],
                ['HOLD / EXIT', `${holdStr} · ${exitLabel}`, '#fff'],
              ] as [string, string, string][]).map(([label, val, color]) => (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
                  <span style={{ fontSize: '16px', color, fontWeight: 700 }}>
                    {label === 'INVESTED'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <img src={coinIcon} width="14" height="14" alt={unit} crossOrigin="anonymous" style={{ objectFit: 'contain' }} />
                        {val.replace(` ${unit}`, '')}
                      </span>
                      : val}
                  </span>
                </div>
              ))}
            </div>

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

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

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
              const isBase = pos.strategy === 'base_sniper';
              const unit = isBase ? 'ETH' : 'SOL';
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
                    {pos.agent_name && (
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ 
                          fontSize: '8px', 
                          padding: '2px 6px', 
                          background: 'rgba(255,255,255,0.05)', 
                          borderRadius: '4px',
                          color: '#aaa',
                          fontFamily: 'var(--fm)',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          {pos.agent_name.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="pv-aname" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{pos.symbol}</span>
                        <a 
                          href={isBase ? `https://gmgn.ai/base/token/${pos.mint}` : `https://gmgn.ai/sol/token/${pos.mint}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontFamily: 'var(--fm)', fontSize: '8px', color: 'inherit', textDecoration: 'none' }}
                          className="opacity-50 hover:opacity-100 hover:text-[var(--c-accent)] hover:underline transition-all duration-300"
                        >
                          {pos.mint.slice(0, 4)}...{pos.mint.slice(-4)}
                        </a>
                      </span>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_percent.toFixed(2)}%</span>
                    </div>
                    <div className="pv-abar" style={{ background: `${colorClass}22`, height: '2px', marginBottom: '4px' }}>
                      <div className="pv-afill" style={{ width: '100%', background: colorClass }}></div>
                    </div>
                    <div className="pv-ast" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span>MODE: {pos.mode.toUpperCase()}</span>
                      <span suppressHydrationWarning>{new Date(pos.opened_at_ms).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_sol.toFixed(4)} {unit}</span>
                    </div>
                    {pos.exit_signature && (
                      <div className="pv-ast" style={{ marginTop: '4px', display: 'flex' }}>
                        <span style={{ color: 'var(--c-accent)', marginRight: '4px' }}>Tx:</span>
                        <a
                          href={isBase ? `https://basescan.org/tx/${pos.exit_signature}` : `https://solscan.io/tx/${pos.exit_signature}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                          onClick={e => e.stopPropagation()}
                          className="text-[var(--c-accent)] hover:text-white hover:underline transition-all duration-300"
                        >
                          {pos.exit_signature}
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
