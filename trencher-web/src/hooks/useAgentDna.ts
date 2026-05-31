'use client';

import { useState, useEffect, useRef } from 'react';
import type { AgentDna } from '@/types';

// ─── Hook ─────────────────────────────────────────────────────────
/**
 * Subscribes to real-time agent DNA updates from the Trencher Agent WS.
 * Listens for:
 *   - AGENT_DNA_UPDATE → full list of agent DNA records
 *
 * Auto-reconnects with exponential backoff.
 */
export function useAgentDna(): { agents: AgentDna[]; connected: boolean; isLoaded: boolean } {
  const [agents, setAgents] = useState<AgentDna[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      'ws://localhost:4001';

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
          if (msg.type === 'AGENT_DNA_UPDATE' && Array.isArray(msg.payload)) {
            setAgents(msg.payload as AgentDna[]);
            setIsLoaded(true);
          }
        } catch (_) {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (!isMountedRef.current) return;

        const delay = Math.min(2000 * 2 ** retryCountRef.current, 30_000);
        retryCountRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    }

    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { agents, connected, isLoaded };
}
