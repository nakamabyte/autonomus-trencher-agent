import { useState, useEffect } from 'react';


interface Trade {
  symbol: string;
  pnl_percent: number;
  pnl_sol: number;
  exit_reason: string;
  entry_mcap: number;
  execution_mode: string;
  hold_minutes: number;
  opened_at: string;
  closed_at: string;
  entry_signature?: string;
  exit_signature?: string;
}

export function AgentTradingHistory({ agentId }: { agentId: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    
    const fetchTrades = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/core-proxy/agent/${agentId}/trades?limit=10`);
        if (!res.ok) throw new Error('Failed to fetch trades');
        
        const data = await res.json();
        if (mounted) {
          setTrades(data.trades || []);
          setError('');
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTrades();
    
    // Poll every 30 seconds for new trades
    const interval = setInterval(fetchTrades, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [agentId]);

  if (loading && trades.length === 0) {
    return (
      <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', border: '1px solid #1a1a24' }}>
        <div style={{ color: '#00C896', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 'bold' }}>
          Trading History
        </div>
        <div style={{ color: '#555', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
          Loading trades...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', border: '1px solid #1a1a24' }}>
        <div style={{ color: '#FF6B6B', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
          Failed to load history: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ color: '#00C896', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
        <span>Trading History</span>
        <span style={{ color: '#888' }}>{trades.length} RECENT</span>
      </div>

      {trades.length === 0 ? (
        <div style={{ color: '#555', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', padding: '12px' }}>
          No closed trades found for this agent yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trades.map((trade, i) => {
            const isWin = trade.pnl_sol > 0;
            const isLive = trade.execution_mode === 'live';
            
            return (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '4px',
                borderLeft: `2px solid ${isWin ? '#00C896' : '#FF6B6B'}`
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>${trade.symbol || 'UNKNOWN'}</span>
                    {isLive ? (
                      <span style={{ fontSize: '9px', background: 'rgba(0,200,150,0.1)', color: '#00C896', padding: '2px 4px', borderRadius: '2px' }}>LIVE MODE</span>
                    ) : (
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', color: '#aaa', padding: '2px 4px', borderRadius: '2px' }}>DRY MODE</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', fontFamily: "'JetBrains Mono', monospace" }}>
                    {trade.closed_at.split(' ')[1]} • {trade.exit_reason}
                  </div>
                  {(trade.entry_signature || trade.exit_signature) && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      {trade.entry_signature && (
                        <a href={`https://solscan.io/tx/${trade.entry_signature}`} target="_blank" rel="noreferrer" style={{ fontSize: '9px', color: '#58a6ff', textDecoration: 'none', background: 'rgba(88,166,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          Entry TX ↗
                        </a>
                      )}
                      {trade.exit_signature && (
                        <a href={`https://solscan.io/tx/${trade.exit_signature}`} target="_blank" rel="noreferrer" style={{ fontSize: '9px', color: '#58a6ff', textDecoration: 'none', background: 'rgba(88,166,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          Exit TX ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ 
                    color: isWin ? '#00C896' : '#FF6B6B', 
                    fontSize: '13px', 
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 'bold'
                  }}>
                    {isWin ? '+' : ''}{trade.pnl_sol.toFixed(4)} SOL
                  </span>
                  <span style={{ 
                    color: isWin ? 'rgba(0,200,150,0.7)' : 'rgba(255,107,107,0.7)', 
                    fontSize: '10px',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    {trade.pnl_percent > 0 ? '+' : ''}{trade.pnl_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
