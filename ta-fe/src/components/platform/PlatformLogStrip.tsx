import { NODES, NODE_FULL } from '@/constants/agents';
import { LC } from '@/constants/layers';
import type { LogEntry } from '@/types';

interface PlatformLogStripProps {
  logs: LogEntry[];
}

const LEVEL_CLS: Record<string, string> = {
  info: 'info',
  warn: 'warn',
  err:  'err',
};

export function PlatformLogStrip({ logs }: PlatformLogStripProps) {
  return (
    <div className="pv-ls">
      <div className="pv-lh">
        <div className="pv-lht">Activity Stream</div>
        <div className="pv-lcnt" id="pv-log-cnt">{logs.length} events</div>
      </div>
      <div className="pv-lb" id="pv-lb">
        {logs.map(e => {
          const node = NODES.find(n => n.id === e.ag);
          const lc = LC[node?.layer || 'iface'];
          return (
            <div key={e.id} className="pv-lr">
              <span className="pv-lt">{e.time}</span>
              <span className="pv-lw" style={{ color: lc.stroke }}>
                {NODE_FULL[e.ag] || e.ag.toUpperCase()}
              </span>
              <span className={`pv-ll ${LEVEL_CLS[e.lv] || 'info'}`} />
              <span className="pv-lm">{e.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
