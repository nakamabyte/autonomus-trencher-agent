import { broadcast } from './wsServer.js';
import { setting, setSetting } from '../db/settings.js';
import { recalcGenesisPerformance } from '../db/performanceTracker.js';

let logIdCounter = 0;

const AGENT_IDS = [
  'orch', 'helius', 'signal', 'trending', 'graduated', 'enrich', 'oracle',
  'wallet', 'fxtwitter', 'filter', 'strategy', 'risk', 'sentiment', 'llm',
  'jup', 'exec', 'monitor', 'tg', 'scheduler'
];

let metrics = {
  cands: 0,
  pos: 0,
  pnl: 0,
  cycles: 0,
  uptime: 0
};

let statuses = {};
AGENT_IDS.forEach(id => {
  statuses[id] = { st: 'idle', load: 0 };
});

let initialStartTimeMs = 0;

export function getMetrics() {
  if (!initialStartTimeMs) {
    try {
      const stored = setting('initial_start_time_ms', '');
      if (stored) {
        initialStartTimeMs = parseInt(stored, 10);
      } else {
        initialStartTimeMs = Date.now();
        setSetting('initial_start_time_ms', initialStartTimeMs.toString());
      }
    } catch (e) {
      // Fallback to process.uptime if DB is not ready yet
      metrics.uptime = Math.floor(process.uptime());
      return metrics;
    }
  }

  metrics.uptime = Math.floor((Date.now() - initialStartTimeMs) / 1000);
  return metrics;
}

export function getStatuses() {
  return statuses;
}

// Passively update state and broadcast
export function updateMetrics(partial) {
  metrics = { ...metrics, ...partial };
  broadcast('METRICS_UPDATE', getMetrics());
}

// Poll DB every 5 seconds to passively update PNL, Pos, Cands
setInterval(async () => {
  try {
    const { db } = await import('../db/connection.js');
    if (!db) return;
    
    const posQuery = db.prepare("SELECT COUNT(*) as count FROM dry_run_positions WHERE status = 'open'").get();
    const pnlQuery = db.prepare("SELECT SUM(pnl_sol) as total FROM dry_run_positions WHERE pnl_sol IS NOT NULL").get();
    const candsQuery = db.prepare("SELECT COUNT(*) as count FROM candidates").get();
    const activePositions = db.prepare("SELECT id, mint, symbol, pnl_percent, pnl_sol, execution_mode, opened_at_ms, entry_signature, strategy_id as strategy, size_sol FROM dry_run_positions WHERE status = 'open' ORDER BY id DESC").all();
    const closedPositions = db.prepare("SELECT id, mint, symbol, pnl_percent, pnl_sol, execution_mode, opened_at_ms, closed_at_ms, entry_signature, exit_signature, size_sol, exit_reason, entry_mcap, strategy_id as strategy FROM dry_run_positions WHERE status = 'closed' ORDER BY closed_at_ms DESC LIMIT 50").all();
    
    const { activeStrategy, setting } = await import('../db/settings.js');
    const strat = activeStrategy();
    
    updateMetrics({
      pos: posQuery?.count || 0,
      pnl: +(pnlQuery?.total || 0).toFixed(3),
      cands: candsQuery?.count || 0,
      mode: setting('trading_mode', 'dry_run'),
      strategy: strat?.id || 'sniper',
      active_positions: activePositions.map(p => ({
        id: p.id,
        mint: p.mint,
        symbol: p.symbol || (p.mint.slice(0, 4) + '...' + p.mint.slice(-4)),
        pnl_percent: p.pnl_percent || 0,
        pnl_sol: p.pnl_sol || 0,
        mode: p.execution_mode,
        opened_at_ms: p.opened_at_ms || 0,
        entry_signature: p.entry_signature || null,
        strategy: p.strategy || null,
        size_sol: p.size_sol || 0
      })),
      closed_positions: closedPositions.map(p => ({
        id: p.id,
        mint: p.mint,
        symbol: p.symbol || (p.mint.slice(0, 4) + '...' + p.mint.slice(-4)),
        pnl_percent: p.pnl_percent || 0,
        pnl_sol: p.pnl_sol || 0,
        mode: p.execution_mode,
        opened_at_ms: p.opened_at_ms || 0,
        closed_at_ms: p.closed_at_ms || 0,
        entry_signature: p.entry_signature || null,
        exit_signature: p.exit_signature || null,
        size_sol: p.size_sol || 0,
        exit_reason: p.exit_reason || null,
        entry_mcap: p.entry_mcap || null,
        strategy: p.strategy || null
      }))
    });
    // ── Broadcast agent DNA list ──────────────────────────────────
    try {
      const { listBreeds } = await import('../db/agentDna.js');
      const agents = listBreeds();
      broadcast('AGENT_DNA_UPDATE', agents);
    } catch (_e) {
      // agentDna table might not exist yet
    }
  } catch (err) {
    // DB might not be initialized yet
  }
}, 5000);

// ── Performance recalc — every 60 seconds ──────────────────────────
setInterval(() => {
  try {
    recalcGenesisPerformance();
  } catch (_) {}
}, 60_000);

export function pulseAgent(id, status = 'active', load = 0.8) {
  if (!statuses[id]) return;
  statuses[id] = { st: status, load };
  broadcast('STATUS_UPDATE', statuses);
  
  // Auto revert to idle after 2 seconds
  setTimeout(() => {
    if (statuses[id].st === status) {
      statuses[id] = { st: 'idle', load: 0.05 };
      broadcast('STATUS_UPDATE', statuses);
    }
  }, 2000);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function nowTs() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const logBuffer = [];

export function getLogHistory() {
  return logBuffer;
}

export function broadcastLog(msg, agent = 'orch', level = 'info') {
  const entry = {
    id: ++logIdCounter,
    time: nowTs(),
    ag: agent,
    lv: level,
    msg
  };
  logBuffer.unshift(entry);
  if (logBuffer.length > 100) logBuffer.pop();
  broadcast('LOG_UPDATE', entry);
}

// Hook into console.log passively
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  
  const str = args.join(' ');
  let agent = 'orch';
  let level = 'info';
  
  if (str.includes('[fatal]') || str.includes('[error]')) level = 'error';
  else if (str.includes('[warn]')) level = 'warn';
  
  if (str.includes('[bot]') || str.includes('orchestrator')) agent = 'orch';
  if (str.includes('[telegram]')) { agent = 'tg'; pulseAgent('tg'); }
  if (str.includes('[db]') || str.includes('enrich')) { agent = 'enrich'; pulseAgent('enrich'); }
  if (str.includes('[llm]')) { agent = 'llm'; pulseAgent('llm'); }
  if (str.includes('[server]') || str.includes('signals,')) { agent = 'signal'; pulseAgent('signal'); }
  if (str.includes('[graduated]')) { agent = 'graduated'; pulseAgent('graduated'); }
  if (str.includes('[trending]')) { agent = 'trending'; pulseAgent('trending'); }
  if (str.includes('[monitor]') || str.includes('[position]')) { agent = 'monitor'; pulseAgent('monitor'); }
  if (str.includes('[router]') || str.includes('[exec]')) { agent = 'exec'; pulseAgent('exec'); }
  if (str.includes('[strategy]')) { agent = 'strategy'; pulseAgent('strategy'); }
  if (str.includes('[candidate]') || str.includes('filtered')) { agent = 'filter'; pulseAgent('filter'); }
  if (str.includes('[ws]') || str.includes('helius')) { agent = 'helius'; pulseAgent('helius'); }
  if (str.includes('[oracle]') || str.includes('price')) { agent = 'oracle'; pulseAgent('oracle'); }
  if (str.includes('wallet')) { agent = 'wallet'; pulseAgent('wallet'); }
  if (str.includes('twitter') || str.includes('fxtwitter')) { agent = 'fxtwitter'; pulseAgent('fxtwitter'); }
  if (str.includes('[risk]') || str.includes('rug')) { agent = 'risk'; pulseAgent('risk'); }
  if (str.includes('[sentiment]')) { agent = 'sentiment'; pulseAgent('sentiment'); }
  if (str.includes('[jupiter]') || str.includes('[jup]')) { agent = 'jup'; pulseAgent('jup'); }
  
  if (str.includes('cycle')) { updateMetrics({ cycles: metrics.cycles + 1 }); pulseAgent('scheduler'); }

  broadcastLog(str, agent, level);
};
