'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlatformMetrics, AgentStatusInfo, LogEntry, AgentStatus } from '@/types';
import { NODES } from '@/constants/agents';
import { LOG_POOL } from '@/constants/platform';

function pad2(n: number) { return String(n).padStart(2, '0'); }
function nowTs() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
export function fmtUp(s: number) {
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
  const logIdRef = useRef(0);

  const tick = useCallback(() => {
    const ids = NODES.map(n => n.id);
    const cnt = Math.floor(Math.random() * 5) + 2;
    const on = [...ids].sort(() => Math.random() - 0.5).slice(0, cnt);

    setStatuses(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        if (on.includes(id)) {
          next[id] = {
            st: Math.random() > 0.4 ? 'active' : 'processing',
            load: 0.38 + Math.random() * 0.58,
          };
        } else if (Math.random() < 0.25) {
          next[id] = { st: 'idle', load: Math.random() * 0.08 };
        }
      });
      return next;
    });

    const [ag, lv, msg] = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
    const entry: LogEntry = {
      id: ++logIdRef.current,
      time: nowTs(),
      ag,
      lv: lv as LogEntry['lv'],
      msg,
    };
    setLogs(prev => [entry, ...prev].slice(0, 80));

    setMetrics(prev => ({
      cands:  prev.cands + Math.floor(Math.random() * 5),
      pos:    Math.max(0, Math.min(8, prev.pos + (Math.random() > 0.55 ? 1 : 0))),
      pnl:    +(prev.pnl + (Math.random() - 0.42) * 0.09).toFixed(3),
      cycles: prev.cycles + 1,
      uptime: prev.uptime + 3,
    }));
  }, []);

  useEffect(() => {
    // reset on mount
    setMetrics(INITIAL_METRICS);
    setStatuses(INITIAL_STATUSES);
    setLogs([]);

    const interval = setInterval(tick, 2600);
    return () => clearInterval(interval);
  }, [tick]);

  return { metrics, statuses, logs };
}
