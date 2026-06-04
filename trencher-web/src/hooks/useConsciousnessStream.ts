'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────
export interface ConsciousnessDecision {
  timestamp: string;
  tier: 'T1' | 'T2';
  symbol: string;
  mint: string;
  wallets_analyzed: number;
  holder_count: number;
  bundle_wallets: number;
  rug_probability: number;        // 0–100
  smart_money_overlap: number;
  runner_signal: string | null;
  kol_signal: string | null;
  confidence: number;             // 0.0–1.0
  verdict: 'BUY' | 'SKIP' | 'ESCALATE';
  reason: string;
  strategy: string | null;
  agent_name?: string | null;
  entry_mcap: number | null;
}

interface UseConsciousnessStreamOptions {
  maxDecisions?: number;
  reconnectDelay?: number;   // base delay ms (doubles on each retry, capped at 30s)
  agentId?: string;          // if provided, fetches past history for this agent
}

interface UseConsciousnessStreamReturn {
  decisions: ConsciousnessDecision[];
  connected: boolean;
  isLoading: boolean;
  stats: {
    total: number;
    buys: number;
    skips: number;
    escalates: number;
  };
}

// ─── Hook ─────────────────────────────────────────────────────────
/**
 * Subscribes to real-time consciousness decisions from the Trencher Agent.
 * Connects to the main WebSocket server and listens for:
 *   - CONSCIOUSNESS_DECISION  → single new decision
 *   - CONSCIOUSNESS_HISTORY   → initial history on connect
 *
 * Features: auto-reconnect with exponential backoff, typed decisions, derived stats.
 */
export function useConsciousnessStream({
  maxDecisions = 30,
  reconnectDelay = 2000,
  agentId,
}: UseConsciousnessStreamOptions = {}): UseConsciousnessStreamReturn {
  const [decisions, setDecisions] = useState<ConsciousnessDecision[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Clear old decisions when agentId changes (e.g. from undefined to UUID)
    setDecisions([]);
    setIsLoading(true);

    // 1. Fetch initial REST history (agent-specific or global)
    const fetchHistory = async () => {
      try {
        const url = agentId 
          ? `/api/core-proxy/agent/${agentId}/decisions?limit=${maxDecisions}`
          : `/api/core-proxy/decisions?limit=${maxDecisions}`;
          
        const headers: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          const secret = localStorage.getItem('trencher_secret_key');
          if (secret) headers['x-client-key'] = secret;
        }

        const res = await fetch(url, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.decisions)) {
              setDecisions(prev => {
                const existingMap = new Map(prev.map(d => [`${d.timestamp}-${d.mint}`, d]));
                data.decisions.forEach((d: ConsciousnessDecision) => existingMap.set(`${d.timestamp}-${d.mint}`, d));
                return Array.from(existingMap.values())
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .slice(0, maxDecisions);
              });
            }
          }
        } catch (err) {
        console.error('Failed to fetch consciousness history:', err);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };
    fetchHistory();

    const wsUrlBase =
      process.env.NEXT_PUBLIC_CONSCIOUSNESS_WS_URL ||
      process.env.NEXT_PUBLIC_WS_URL ||
      'ws://localhost:4001';
      
    const wsUrl = agentId ? `${wsUrlBase}?agentId=${agentId}` : wsUrlBase;

    function connect() {
      if (!isMountedRef.current) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(); return; }
        setConnected(true);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);

          if (msg.type === 'CONSCIOUSNESS_DECISION' && msg.payload) {
            const payload = msg.payload as ConsciousnessDecision;
            if (!agentId || payload.strategy === agentId) {
              setDecisions(prev =>
                [payload, ...prev].slice(0, maxDecisions)
              );
            }
          } else if (msg.type === 'CONSCIOUSNESS_HISTORY' && Array.isArray(msg.payload)) {
            // History arrives newest-first already (reversed by getRecentDecisions)
            setDecisions((msg.payload as ConsciousnessDecision[]).slice(0, maxDecisions));
          }
        } catch (_) {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (!isMountedRef.current) return;

        // Exponential backoff: 2s → 4s → 8s … capped at 30s
        const delay = Math.min(reconnectDelay * 2 ** retryCountRef.current, 30_000);
        retryCountRef.current += 1;

        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror — no extra action needed
        setConnected(false);
      };
    }

    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on explicit unmount
        wsRef.current.close();
      }
    };
  }, [agentId, maxDecisions, reconnectDelay]);

  // Derived stats
  const stats = {
    total:     decisions.length,
    buys:      decisions.filter(d => d.verdict === 'BUY').length,
    skips:     decisions.filter(d => d.verdict === 'SKIP').length,
    escalates: decisions.filter(d => d.verdict === 'ESCALATE').length,
  };

  return { decisions, connected, isLoading, stats };
}
