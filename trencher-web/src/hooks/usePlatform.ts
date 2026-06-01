'use client';

import { useState, useEffect } from 'react';
import type { PlatformMetrics, AgentStatusInfo, LogEntry, AgentStatus } from '@/types';
import { NODES } from '@/constants/agents';

export function fmtUp(s: number) {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

const INITIAL_METRICS: PlatformMetrics = {
  cands: 0, pos: 1, pnl: 0, cycles: 0, uptime: 0,
};

const INITIAL_STATUSES: Record<string, AgentStatusInfo> = Object.fromEntries(
  NODES.map(n => [n.id, { st: 'idle' as AgentStatus, load: 0 }])
);

export function usePlatform() {
  const [metrics, setMetrics] = useState<PlatformMetrics>(INITIAL_METRICS);
  const [statuses, setStatuses] = useState<Record<string, AgentStatusInfo>>(INITIAL_STATUSES);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimer: NodeJS.Timeout;

    function connect() {
      if (!isMounted) return;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'METRICS_UPDATE') {
            setMetrics(data.payload);
          } else if (data.type === 'STATUS_UPDATE') {
            setStatuses(data.payload);
          } else if (data.type === 'LOG_HISTORY') {
            setLogs(data.payload);
          } else if (data.type === 'LOG_UPDATE') {
            setLogs(prev => [data.payload, ...prev].slice(0, 100));
          }
        } catch (err) {}
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  return { metrics, statuses, logs };
}

