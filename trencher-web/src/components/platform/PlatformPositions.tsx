'use client';

import type { PlatformMetrics } from '@/types';

interface PlatformPositionsProps {
  metrics: PlatformMetrics;
  logHeight: number;
}

export function PlatformPositions({ metrics, logHeight }: PlatformPositionsProps) {
  const positions = metrics.active_positions || [];

  return (
    <div 
      className="absolute top-10 left-4 z-20 pointer-events-auto flex flex-col"
      style={{ width: '240px', maxHeight: 'calc(100% - 40px)', background: '#111110', border: '1px solid rgba(255,255,255,.06)', borderRadius: '2px' }}
    >
      <div className="pv-sec flex flex-col flex-1 min-h-0" style={{ borderBottom: 'none' }}>
        <div className="pv-sh" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#30E000] animate-pulse"></div>
            ACTIVE POSITIONS
          </span>
          <span style={{ color: 'rgba(255,255,255,.15)', fontFamily: 'var(--fm)' }}>{metrics.pos}</span>
        </div>

        <div className="flex flex-col gap-[2px] mt-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {positions.length === 0 ? (
            <div className="pv-ai" style={{ justifyContent: 'center' }}>
              <span className="pv-ast" style={{ opacity: 0.5 }}>[ NO ACTIVE POSITIONS ]</span>
            </div>
          ) : (
            positions.map((pos) => {
              const isProfit = pos.pnl_percent >= 0;
              const colorClass = isProfit ? '#4ADE80' : '#F87171'; // Matching pv-mv.pos / neg
              const sign = isProfit ? '+' : '';
              const isBase = pos.strategy === 'base_sniper';
              const unit = isBase ? 'ETH' : 'SOL';
              return (
                <div key={pos.id} className="pv-ai">
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="group-hover:text-[var(--c-accent)] transition-colors duration-300">{pos.symbol}</span>
                        <a 
                          href={isBase ? `https://gmgn.ai/base/token/${pos.mint}` : `https://gmgn.ai/sol/token/${pos.mint}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 30 }}
                          className="group"
                        >
                          <span 
                            style={{ fontFamily: 'var(--fm)', fontSize: '8px' }}
                            className="opacity-50 group-hover:opacity-100 group-hover:text-white transition-all duration-300"
                          >
                            {pos.mint.slice(0, 4)}...{pos.mint.slice(-4)}
                          </span>
                        </a>
                      </div>
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
                    {pos.entry_signature && (
                      <div className="pv-ast" style={{ marginTop: '4px', display: 'flex' }}>
                        <span style={{ color: 'var(--c-accent)', marginRight: '4px' }}>Tx:</span>
                        <a 
                          href={isBase ? `https://basescan.org/tx/${pos.entry_signature}` : `https://solscan.io/tx/${pos.entry_signature}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          onClick={e => e.stopPropagation()}
                          style={{ position: 'relative', zIndex: 30, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                          className="text-[var(--c-accent)] hover:text-white hover:underline transition-all duration-300"
                        >
                          {pos.entry_signature}
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
    </div>
  );
}
