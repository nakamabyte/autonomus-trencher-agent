'use client';

import { NODES, NODE_FULL, AGENT_DATA } from '@/constants/agents';
import { LC } from '@/constants/layers';
import type { AgentStatusInfo } from '@/types';

interface AgentsTableProps {
  statuses: Record<string, AgentStatusInfo>;
  onOpenAgent: (id: string) => void;
}

const ST_DOT: Record<string, string> = {
  idle: '#555',
  active: '#4ADE80',
  processing: '#D97706',
  error: '#DC2626',
};

export function AgentsTable({ statuses, onOpenAgent }: AgentsTableProps) {
  return (
    <section id="agents-full">
      <div className="wrap">
        <div className="sec-label">Full Roster</div>
        <h2 className="sec-h2" style={{ color: '#fff' }}>All 19 Agents</h2>
        <p className="sec-body" style={{ color: 'rgba(255,255,255,.4)' }}>
          Click any agent to inspect its role and connections.
        </p>
        <table className="agents-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Agent Name</th>
              <th>Layer</th>
              <th>Inputs From</th>
              <th>Outputs To</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {NODES.map(n => {
              const lc = LC[n.layer];
              const d = AGENT_DATA[n.id];
              const from = (d?.connects_from || []).join(', ') || '—';
              const to = (d?.connects_to || []).join(', ') || '—';
              const info = statuses[n.id] || { st: 'idle', load: 0 };
              return (
                <tr key={n.id} onClick={() => onOpenAgent(n.id)}>
                  <td><span className="a-id">{n.id}</span></td>
                  <td style={{ color: '#fff' }}>{NODE_FULL[n.id]}</td>
                  <td>
                    <span
                      className="a-layer-badge"
                      style={{ background: lc.fill, color: lc.text }}
                    >
                      {n.layer}
                    </span>
                  </td>
                  <td style={{ fontSize: '8.5px', color: 'rgba(255,255,255,.35)' }}>{from}</td>
                  <td style={{ fontSize: '8.5px', color: 'rgba(255,255,255,.35)' }}>{to}</td>
                  <td>
                    <span
                      className="a-status-dot"
                      style={{ background: ST_DOT[info.st] || '#555' }}
                    />
                    <span style={{ fontSize: '8.5px' }}>{info.st}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
