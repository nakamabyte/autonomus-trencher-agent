export type LayerKey = 'core' | 'data' | 'enrich' | 'analysis' | 'decision' | 'exec' | 'iface';
export type AgentStatus = 'idle' | 'active' | 'processing' | 'error';
export type LogLevel = 'info' | 'warn' | 'err';

export interface AgentNode {
  id: string;
  label: string;
  sub: string;
  layer: LayerKey;
  r: number;
}

export interface AgentEdge {
  source: string;
  target: string;
}

export interface AgentInfo {
  role: string;
  connects_from: string[];
  connects_to: string[];
}

export interface LayerColor {
  fill: string;
  stroke: string;
  text: string;
  grad: string;
}

export interface LayerInfo {
  title: string;
  agents: string[];
  desc: string;
  details: [string, string][];
}

export interface LogEntry {
  id: number;
  time: string;
  ag: string;
  lv: LogLevel;
  msg: string;
}

export interface PlatformMetrics {
  cands: number;
  pos: number;
  pnl: number;
  cycles: number;
  uptime: number;
  mode?: string;
  strategy?: string;
  active_positions?: {
    id: number;
    mint: string;
    symbol: string;
    pnl_percent: number;
    pnl_sol: number;
    mode: string;
    opened_at_ms: number;
    entry_signature?: string | null;
    strategy?: string | null;
    size_sol?: number;
  }[];
  closed_positions?: {
    id: number;
    mint: string;
    symbol: string;
    pnl_percent: number;
    pnl_sol: number;
    mode: string;
    opened_at_ms: number;
    closed_at_ms: number;
    size_sol: number;
    exit_reason: string | null;
    entry_mcap: number | null;
    strategy: string | null;
    entry_signature?: string | null;
    exit_signature?: string | null;
  }[];
}

export interface AgentStatusInfo {
  st: AgentStatus;
  load: number;
}

export interface PipelineStep {
  num: string;
  icon: string;
  color: string;
  title: string;
  desc: string;
  items: string[];
}

export interface FeatureItem {
  num: string;
  title: string;
  desc: string;
  more: string;
}

export interface ModeCard {
  num: string;
  name: string;
  title: string;
  desc: string;
  code: string;
  featured?: boolean;
  badge?: string;
  items: string[];
}

export interface StrategyCard {
  num: string;
  name: string;
  color: string;
  desc: string;
  tags: string[];
  params: [string, string][];
}

export interface HeroStat {
  value: string;
  suffix: string;
  label: string;
}

export interface SidebarLayer {
  k: LayerKey;
  n: string;
  c: string;
  cnt: number;
}
