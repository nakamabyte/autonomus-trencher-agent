const Database = require('better-sqlite3');
const db = new Database('trencher-agent.sqlite');

const positions = db.prepare(`SELECT status, strategy_id, exit_reason, pnl_percent, pnl_sol, snapshot_json FROM dry_run_positions WHERE status='closed' AND strategy_id='sniper'`).all();

let bins = { '<50k': {win:0, loss:0}, '50k-100k': {win:0, loss:0}, '>100k': {win:0, loss:0} };

positions.forEach(p => {
  const isWin = p.pnl_sol > 0;
  const snapshot = JSON.parse(p.snapshot_json);
  const mcap = snapshot.candidate.enrichment?.gmgn?.marketcap || 0;
  
  if (mcap < 50000) bins['<50k'][isWin?'win':'loss']++;
  else if (mcap < 100000) bins['50k-100k'][isWin?'win':'loss']++;
  else bins['>100k'][isWin?'win':'loss']++;
});

console.log('Sniper Win/Loss by Mcap:');
console.table(bins);
