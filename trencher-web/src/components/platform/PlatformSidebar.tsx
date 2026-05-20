import { NODES } from '@/constants/agents';
import { LC, SIDEBAR_LAYERS } from '@/constants/layers';
import type { AgentStatusInfo } from '@/types';

const ST_DOT: Record<string, string> = {
  idle: '#D0D0CE',
  active: '#16A34A',
  processing: '#D97706',
  error: '#DC2626',
};

interface PlatformSidebarProps {
  statuses: Record<string, AgentStatusInfo>;
  onOpenAgent: (id: string) => void;
}

export function PlatformSidebar({ statuses, onOpenAgent }: PlatformSidebarProps) {
  return (
    <div className="pv-sb" id="pv-sb">
      {/* Agent Roster */}
      <div className="pv-sec">
        <div className="pv-sh">
          Agent Roster — {NODES.filter(n => n.layer !== 'core').length} sub-agents
        </div>
        {NODES.map(n => {
          const lc = LC[n.layer];
          const info = statuses[n.id] || { st: 'idle', load: 0 };
          const dotColor = ST_DOT[info.st] || '#555';
          const barWidth = `${Math.round((info.load || 0) * 100)}%`;
          const isActive = info.st === 'active';
          return (
            <div
              key={n.id}
              id={`pv-ai-${n.id}`}
              className="pv-ai"
              style={{
                background: lc.fill,
                borderColor: isActive ? lc.stroke : undefined,
              }}
              onClick={() => onOpenAgent(n.id)}
            >
              <div
                className="pv-adot"
                id={`pv-dot-${n.id}`}
                style={{ background: dotColor }}
              />
              <div className="pv-ainfo">
                <div
                  className="pv-aname"
                  style={{ color: lc.text }}
                >
                  {n.label} / {n.sub}
                </div>
                <div className="pv-abar" style={{ background: `${lc.stroke}22` }}>
                  <div
                    className="pv-afill"
                    id={`pv-bar-${n.id}`}
                    style={{ width: barWidth, background: lc.stroke }}
                  />
                </div>
              </div>
              <div className="pv-ast" id={`pv-ast-${n.id}`}>
                {info.st}
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer Map */}
      <div className="pv-sec" style={{ flex: 1 }}>
        <div className="pv-sh">Layer Map</div>
        {SIDEBAR_LAYERS.map(l => (
          <div key={l.k} className="pv-lrow">
            <div className="pv-ldot" style={{ background: l.c }} />
            <span className="pv-lname">{l.n}</span>
            <span className="pv-lcount">{l.cnt} agents</span>
          </div>
        ))}
      </div>
    </div>
  );
}
