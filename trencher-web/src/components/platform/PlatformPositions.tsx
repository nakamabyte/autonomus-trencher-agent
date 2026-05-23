'use client';

import type { PlatformMetrics } from '@/types';

interface PlatformPositionsProps {
  metrics: PlatformMetrics;
}

export function PlatformPositions({ metrics }: PlatformPositionsProps) {
  const positions = metrics.active_positions || [];

  return (
    <div 
      className="absolute top-4 left-4 z-20 pointer-events-auto flex flex-col"
      style={{ width: '240px', background: '#111110', border: '1px solid rgba(255,255,255,.06)', borderRadius: '2px' }}
    >
      <div className="pv-sec" style={{ borderBottom: 'none' }}>
        <div className="pv-sh" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#30E000] animate-pulse"></div>
            ACTIVE POSITIONS
          </span>
          <span style={{ color: 'rgba(255,255,255,.15)', fontFamily: 'var(--fm)' }}>{metrics.pos}</span>
        </div>

        <div className="flex flex-col gap-[2px] mt-2 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
          {positions.length === 0 ? (
            <div className="pv-ai" style={{ justifyContent: 'center' }}>
              <span className="pv-ast" style={{ opacity: 0.5 }}>[ NO ACTIVE POSITIONS ]</span>
            </div>
          ) : (
            positions.map((pos) => {
              const isProfit = pos.pnl_percent >= 0;
              const colorClass = isProfit ? '#4ADE80' : '#F87171'; // Matching pv-mv.pos / neg
              const sign = isProfit ? '+' : '';
              return (
                <div key={pos.id} className="pv-ai">
                  <div className="pv-adot" style={{ background: colorClass }}></div>
                  <div className="pv-ainfo">
                    <div className="pv-aname" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span title={pos.mint}>{pos.mint.slice(0, 4)}...{pos.mint.slice(-4)}</span>
                      <span style={{ color: colorClass }}>{sign}{pos.pnl_percent.toFixed(2)}%</span>
                    </div>
                    <div className="pv-abar" style={{ background: `${colorClass}22`, height: '2px', marginBottom: '4px' }}>
                      <div className="pv-afill" style={{ width: '100%', background: colorClass }}></div>
                    </div>
                    <div className="pv-ast" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>MODE: {pos.mode.toUpperCase()}</span>
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
