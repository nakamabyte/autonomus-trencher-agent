// signal-server/src/api/mcpEndpoints.js

function setupMcpApiEndpoints(app, db, getLatestSignals, getRecentDecisions) {

  // /api/status
  app.get('/api/status', requireApiKey, (req, res) => {
    const settings = db.prepare('SELECT key, value FROM settings').all()
    const openPositions = db.prepare(
      "SELECT COUNT(*) as count FROM dry_run_positions WHERE status = 'open'"
    ).get()
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_trades,
        ROUND(SUM(CASE WHEN pnl_percent > 0 THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as win_rate,
        ROUND(SUM(pnl_sol), 4) as total_pnl_sol
      FROM dry_run_positions WHERE status = 'closed'
    `).get()

    res.json({
      mode: settings.find(s => s.key === 'trading_mode')?.value || 'unknown',
      strategy: settings.find(s => s.key === 'active_strategy')?.value || 'sniper',
      open_positions: openPositions.count,
      total_trades: stats.total_trades,
      win_rate: stats.win_rate,
      pnl_sol: stats.total_pnl_sol,
      chains: ['solana', 'base'],
      nodes: 19,
      uptime_ms: process.uptime() * 1000,
    })
  })

  // /api/agent/dna
  app.get('/api/agent/dna', requireApiKey, (req, res) => {
    const dna = db.prepare('SELECT * FROM agent_dna ORDER BY created_at_ms DESC LIMIT 1').get()
    res.json(dna || { error: 'no DNA profile found' })
  })

  // /api/trades
  app.get('/api/trades', requireApiKey, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const chain = req.query.chain || 'solana'
    const trades = db.prepare(`
      SELECT symbol, pnl_percent, pnl_sol, exit_reason, entry_mcap,
        strategy_id, execution_mode,
        (closed_at_ms - opened_at_ms) / 60000.0 as hold_minutes,
        datetime(opened_at_ms/1000, 'unixepoch') as opened_at,
        datetime(closed_at_ms/1000, 'unixepoch') as closed_at
      FROM dry_run_positions
      WHERE status = 'closed'
      ORDER BY closed_at_ms DESC
      LIMIT ?
    `).all(limit)
    res.json({ count: trades.length, trades })
  })

  // /api/search
  app.get('/api/search', requireApiKey, (req, res) => {
    const q = req.query.q
    if (!q) return res.status(400).json({ error: 'query required' })
    const results = db.prepare(`
      SELECT * FROM dry_run_positions
      WHERE symbol LIKE ? OR mint LIKE ?
      ORDER BY opened_at_ms DESC LIMIT 10
    `).all(`%${q}%`, `%${q}%`)
    res.json({ query: q, count: results.length, results })
  })

  // /api/burn
  app.get('/api/burn', requireApiKey, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const history = db.prepare(`
      SELECT * FROM burn_log ORDER BY created_at_ms DESC LIMIT ?
    `).all(limit);

    const stats = db.prepare(`
      SELECT 
        SUM(sol_spent) as total_sol_spent,
        SUM(autr_burned) as total_autr_burned
      FROM burn_log
    `).get();

    const deploys = db.prepare(`
      SELECT COUNT(*) as count FROM agent_dna
    `).get();

    res.json({ 
      history, 
      stats: {
        total_sol_spent: stats.total_sol_spent || 0,
        total_autr_burned: stats.total_autr_burned || 0,
        total_deploys: deploys.count || 0
      }
    });
  });
}

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key']
  const keysStr = process.env.API_KEYS || process.env.API_KEY || '';
  const validKeys = new Set(keysStr.split(','))
  if (!key || !validKeys.has(key)) {
    return res.status(401).json({ error: 'invalid API key' })
  }
  next()
}

module.exports = { setupMcpApiEndpoints }

