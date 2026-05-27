'use client';

import type { PlatformMetrics } from '@/types';

interface PlatformHistoryProps {
  metrics: PlatformMetrics;
  rightOffset?: number;
  logHeight: number;
}

export function PlatformHistory({ metrics, rightOffset = 16, logHeight }: PlatformHistoryProps) {
  const positions = metrics.closed_positions || [];

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
                <div key={pos.id} className="pv-ai">
                  <div className="pv-adot" style={{ background: colorClass }}></div>
                  <div className="pv-ainfo">
                    <div className="pv-aname" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <a 
                        href={`https://gmgn.ai/sol/token/${pos.mint}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={pos.mint}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                        className="hover:underline"
                      >
                        <span>{pos.symbol}</span>
                        <span style={{ opacity: 0.5, fontFamily: 'var(--fm)', fontSize: '8px' }}>
                          {pos.mint.slice(0, 4)}...{pos.mint.slice(-4)}
                        </span>
                      </a>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_percent.toFixed(2)}%</span>
                    </div>
                    <div className="pv-abar" style={{ background: `${colorClass}22`, height: '2px', marginBottom: '4px' }}>
                      <div className="pv-afill" style={{ width: '100%', background: colorClass }}></div>
                    </div>
                    <div className="pv-ast" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>MODE: {pos.mode.toUpperCase()}</span>
                      <span suppressHydrationWarning>{new Date(pos.opened_at_ms).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_sol.toFixed(4)} SOL</span>
                    </div>
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
