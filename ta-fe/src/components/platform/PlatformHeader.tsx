import type { PlatformMetrics } from '@/types';

function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtUp(s: number) {
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

interface PlatformHeaderProps {
  metrics: PlatformMetrics;
  onClosePlatform: () => void;
}

function MetricCell({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="pv-mc">
      <div className="pv-mk">{label}</div>
      <div className={`pv-mv${cls ? ` ${cls}` : ''}`}>{value}</div>
    </div>
  );
}

export function PlatformHeader({ metrics, onClosePlatform }: PlatformHeaderProps) {
  const pnlStr = (metrics.pnl >= 0 ? '+' : '') + metrics.pnl.toFixed(3);
  const pnlCls = metrics.pnl >= 0 ? 'pos' : 'neg';

  return (
    <div className="pv-hd">
      <div className="pv-logo">TRENCHER<em>.</em>AGENT</div>
      <button className="pv-back" onClick={onClosePlatform} type="button">
        ← Back to Landing
      </button>
      <div className="pv-mx" id="pv-metrics">
        <MetricCell label="Candidates" value={String(metrics.cands).padStart(5, '0')} />
        <MetricCell label="Positions"  value={String(metrics.pos)} />
        <MetricCell label="PnL (SOL)"  value={pnlStr} cls={pnlCls} />
        <MetricCell label="Cycles"     value={String(metrics.cycles)} />
        <MetricCell label="Uptime"     value={fmtUp(metrics.uptime)} />
        <MetricCell label="Nodes"      value="19" />
      </div>
      <div className="pv-badge">
        <div className="pv-bdot" />
        SYSTEM ACTIVE
      </div>
    </div>
  );
}
