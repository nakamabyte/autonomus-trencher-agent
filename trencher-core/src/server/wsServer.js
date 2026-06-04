import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { consciousnessStream, getRecentDecisions } from '../consciousness/decisionLog.js';

function extractTokenInfo(r) {
  let symbol = r.selected_mint ? r.selected_mint.slice(0, 4) : 'UNK';
  let name = null;
  const parseJson = (jsonStr) => {
    if (jsonStr && jsonStr !== '{}' && jsonStr !== 'null') {
      try { return JSON.parse(jsonStr); } catch (e) { }
    }
    return null;
  };
  const tokenData = parseJson(r.token_json) || parseJson(r.candidate_json);
  if (tokenData) {
    symbol = tokenData.symbol || tokenData.token?.symbol || symbol;
    name = tokenData.name || tokenData.token?.name || null;
  }
  return { symbol, name };
}

function mapDbDecision(r) {
  const info = extractTokenInfo(r);
  return {
    timestamp: new Date(r.at_ms).toISOString().slice(11, 19),
    tier: 'T1',
    symbol: info.symbol,
    name: info.name,
    mint: r.selected_mint,
    wallets_analyzed: 0,
    holder_count: 0,
    bundle_wallets: Math.round((r.bundle_wallets || 0) * 100),
    rug_probability: Math.round((r.rug_probability || 0) * 100),
    smart_money_overlap: r.smart_money_overlap || 0,
    runner_signal: r.runner_signal || null,
    kol_signal: r.kol_signal || null,
    confidence: r.confidence,
    verdict: r.verdict,
    reason: r.reason,
    strategy: r.strategy_id,
    agent_name: r.agent_name || null,
    entry_mcap: r.entry_mcap || null,
  };
}

let wss;
const clients = new Set();

export function startWsServer(port = 4001) {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Helper for API Auth
    const requireAuth = () => {
      const key = req.headers['x-api-key'];
      const validKey = process.env.SIGNAL_SERVER_KEY || 'kucing_oreng_sniping_2026';
      if (!key || key !== validKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid API key' }));
        return false;
      }
      return true;
    };

    // MCP status endpoint
    if (pathname === '/api/status' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const { db } = await import('../db/connection.js');
        const settings = db.prepare('SELECT key, value FROM settings').all();
        const openPositions = db.prepare(
          "SELECT COUNT(*) as count FROM dry_run_positions WHERE status = 'open'"
        ).get();
        const stats = db.prepare(`
          SELECT
            COUNT(*) as total_trades,
            ROUND(SUM(CASE WHEN pnl_percent > 0 THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as win_rate,
            ROUND(SUM(pnl_sol), 4) as total_pnl_sol
          FROM dry_run_positions WHERE status = 'closed'
        `).get();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          mode: settings.find(s => s.key === 'trading_mode')?.value || 'unknown',
          strategy: settings.find(s => s.key === 'active_strategy')?.value || 'sniper',
          open_positions: openPositions.count,
          total_trades: stats.total_trades,
          win_rate: stats.win_rate,
          pnl_sol: stats.total_pnl_sol,
          chains: ['solana', 'base'],
          nodes: 19,
          uptime_ms: process.uptime() * 1000,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // MCP agent DNA endpoint
    if (pathname === '/api/agent/dna' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const { db } = await import('../db/connection.js');
        const limitParam = parsedUrl.searchParams.get('limit');
        const query = 'SELECT * FROM agent_dna ORDER BY created_at_ms DESC';
        const dna = limitParam ? db.prepare(query + ' LIMIT ?').all(parseInt(limitParam)) : db.prepare(query).all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dna));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // MCP burn history endpoint
    if (pathname === '/api/burn' && req.method === 'GET') {
      try {
        const { db } = await import('../db/connection.js');
        const history = db.prepare('SELECT * FROM burn_log ORDER BY created_at_ms DESC LIMIT 100').all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ history }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // MCP trades history endpoint
    if (pathname === '/api/trades' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const limitParam = parsedUrl.searchParams.get('limit');
        const limit = Math.min(parseInt(limitParam) || 20, 100);
        const { db } = await import('../db/connection.js');
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
        `).all(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count: trades.length, trades }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // MCP search endpoint
    if (pathname === '/api/search' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const q = parsedUrl.searchParams.get('q');
        if (!q) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'query required' }));
          return;
        }
        const { db } = await import('../db/connection.js');
        const results = db.prepare(`
          SELECT * FROM dry_run_positions
          WHERE symbol LIKE ? OR mint LIKE ?
          ORDER BY opened_at_ms DESC LIMIT 10
        `).all(`%${q}%`, `%${q}%`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ query: q, count: results.length, results }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // MCP signals endpoint (Proxy to signal-server)
    if (pathname === '/api/signals' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const chain = parsedUrl.searchParams.get('chain') || 'solana';
        const limit = parsedUrl.searchParams.get('limit') || '10';
        const signalUrl = (process.env.SIGNAL_SERVER_URL || 'https://signal-server-production-e554.up.railway.app/api')
          .replace(/\/api$/, '');
        const targetUrl = `${signalUrl}/api/signals?chain=${chain}&limit=${limit}`;
        const response = await fetch(targetUrl, {
          headers: { 'x-api-key': process.env.SIGNAL_SERVER_KEY || 'kucing_oreng_sniping_2026' }
        });
        if (!response.ok) {
          throw new Error(`Signal server responded with status: ${response.status}`);
        }
        const signalData = await response.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(signalData));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // MCP consciousness/enriched endpoint
    if (pathname === '/api/signals/enriched' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const limitParam = parsedUrl.searchParams.get('limit') || '15';
        const limit = Math.min(parseInt(limitParam) || 15, 50);
        const recentDecisions = getRecentDecisions(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          count: recentDecisions.length,
          decisions: recentDecisions.map(d => ({
            symbol: d.symbol,
            mint: d.mint,
            confidence: d.confidence,
            verdict: d.verdict,
            runner_signal: d.runner_signal,
            rug_probability: d.rug_probability,
            smart_money_overlap: d.smart_money_overlap,
            strategy: d.strategy,
            entry_mcap: d.entry_mcap,
            timestamp: d.timestamp,
          }))
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Get agent "can go live" status
    const canGoLiveMatch = pathname.match(/^\/api\/agent\/([^\/]+)\/can-go-live$/);
    if (canGoLiveMatch && req.method === 'GET') {
      try {
        const agentId = canGoLiveMatch[1];
        const { db } = await import('../db/connection.js');
        const agent = db.prepare('SELECT * FROM agent_dna WHERE id = ?').get(agentId);
        if (!agent) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Agent not found' }));
          return;
        }

        const agentKey = req.headers['x-agent-key'];
        if (agent.agent_secret_key && agent.agent_secret_key !== agentKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: invalid agent secret key' }));
          return;
        }

        const genesis = db.prepare('SELECT id FROM agent_dna ORDER BY created_at_ms ASC LIMIT 1').get();
        const isGenesis = genesis && genesis.id === agentId;

        let balanceSol = 0;
        let address = '';

        try {
          if (isGenesis) {
            const { liveWalletBalanceLamports, liveWalletPubkey } = await import('../liveExecutor.js');
            const lamports = await liveWalletBalanceLamports();
            balanceSol = lamports / 1_000_000_000;
            address = liveWalletPubkey();
          } else if (agent.agent_wallet) {
            const { Connection, PublicKey } = await import('@solana/web3.js');
            const { SOLANA_RPC_URL } = await import('../config.js');
            const connection = new Connection(SOLANA_RPC_URL);
            const balance = await connection.getBalance(new PublicKey(agent.agent_wallet));
            balanceSol = balance / 1_000_000_000;
            address = agent.agent_wallet;
          }
        } catch (e) {
          console.error('[can-go-live] failed to fetch wallet balance:', e.message);
        }

        const dryRunTrades = db.prepare(`
          SELECT COUNT(*) as count FROM dry_run_positions
          WHERE execution_mode = 'dry_run' AND (${isGenesis ? 'agent_dna_id = ? OR agent_dna_id IS NULL' : 'agent_dna_id = ?'})
        `).get(agentId).count;

        const ok = balanceSol >= 0.1;
        const result = {
          ok,
          reason: ok ? undefined : 'fund agent wallet first (min 0.1 SOL)',
          warning: ok && dryRunTrades < 10 ? 'agent has < 10 dry run trades, consider testing more' : undefined,
          wallet_balance_sol: balanceSol,
          dry_run_trades: dryRunTrades,
          wallet_address: address
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Get agent decisions history
    const agentDecisionsMatch = pathname.match(/^\/api\/agent\/([^\/]+)\/decisions$/);
    if (agentDecisionsMatch && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const agentId = agentDecisionsMatch[1];
        const limitParam = parsedUrl.searchParams.get('limit') || '30';
        const limit = Math.min(parseInt(limitParam) || 30, 100);
        const { db } = await import('../db/connection.js');
        const rows = db.prepare(`
          SELECT d.*, a.name as agent_name 
          FROM decision_logs d
          LEFT JOIN agent_dna a ON d.strategy_id = a.id
          WHERE d.strategy_id = ? 
          ORDER BY d.at_ms DESC 
          LIMIT ?
        `).all(agentId, limit);

        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN verdict = 'BUY' THEN 1 ELSE 0 END) as buys,
            SUM(CASE WHEN verdict = 'ESCALATE' THEN 1 ELSE 0 END) as escalates,
            SUM(CASE WHEN verdict = 'SKIP' THEN 1 ELSE 0 END) as skips
          FROM decision_logs 
          WHERE strategy_id = ?
        `).get(agentId);

        const execution_mode = db.prepare('SELECT execution_mode FROM agent_dna WHERE id = ?').get(agentId)?.execution_mode || 'offline';

        // Map db row to ConsciousnessDecision format
        const decisions = rows.map(mapDbDecision);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          count: decisions.length,
          decisions,
          stats: {
            total: stats.total || 0,
            buys: stats.buys || 0,
            escalates: stats.escalates || 0,
            skips: stats.skips || 0
          },
          execution_mode
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Get global decisions history
    if (pathname === '/api/decisions' && req.method === 'GET') {
      if (!requireAuth()) return;
      try {
        const limitParam = parsedUrl.searchParams.get('limit') || '30';
        const limit = Math.min(parseInt(limitParam) || 30, 100);
        const { db } = await import('../db/connection.js');
        const rows = db.prepare(`
          SELECT d.*, a.name as agent_name 
          FROM decision_logs d
          LEFT JOIN agent_dna a ON d.strategy_id = a.id
          ORDER BY d.at_ms DESC 
          LIMIT ?
        `).all(limit);

        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN verdict = 'BUY' THEN 1 ELSE 0 END) as buys,
            SUM(CASE WHEN verdict = 'ESCALATE' THEN 1 ELSE 0 END) as escalates,
            SUM(CASE WHEN verdict = 'SKIP' THEN 1 ELSE 0 END) as skips
          FROM decision_logs 
        `).get();

        const decisions = rows.map(mapDbDecision);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          count: decisions.length,
          decisions,
          stats: {
            total: stats.total || 0,
            buys: stats.buys || 0,
            escalates: stats.escalates || 0,
            skips: stats.skips || 0
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }


    // Set agent execution mode
    const setModeMatch = pathname.match(/^\/api\/agent\/([^\/]+)\/set-mode$/);
    if (setModeMatch && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const agentId = setModeMatch[1];
          
          const { db } = await import('../db/connection.js');
          const agent = db.prepare('SELECT agent_secret_key FROM agent_dna WHERE id = ?').get(agentId);
          if (!agent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Agent not found' }));
            return;
          }

          const agentKey = req.headers['x-agent-key'];
          if (agent.agent_secret_key && agent.agent_secret_key !== agentKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: invalid agent secret key' }));
            return;
          }

          const { mode } = payload;
          if (!['dry_run', 'live'].includes(mode)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid mode' }));
            return;
          }

          db.prepare('UPDATE agent_dna SET execution_mode = ?, updated_at_ms = ? WHERE id = ?').run(mode, Date.now(), agentId);

          const { listBreeds } = await import('../db/agentDna.js');
          broadcast('AGENT_DNA_UPDATE', listBreeds());

          const msg = `🔄 <b>Agent Mode Changed</b>\n\n` +
            `<b>Agent ID:</b> ${agentId}\n` +
            `<b>New Mode:</b> ${mode.toUpperCase()}`;
          import('../telegram/send.js').then(({ sendTelegram }) => sendTelegram(msg)).catch(() => { });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, mode }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Deploy Agent API
    if (req.url === '/api/deploy' && req.method === 'POST') {
      if (!requireAuth()) return;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { createDna, listBreeds } = await import('../db/agentDna.js');
          const newAgent = createDna(payload);
          broadcast('AGENT_DNA_UPDATE', listBreeds());

          const msg = `🧬 <b>New Agent Spawned!</b>\n\n` +
            `<b>Name:</b> ${newAgent.name}\n` +
            `<b>Breed:</b> ${newAgent.breed}\n` +
            `<b>Aggression:</b> ${newAgent.aggression}%\n` +
            `<b>Wallet:</b> <code>${newAgent.agent_wallet}</code>`;
          import('../telegram/send.js').then(({ sendTelegram }) => sendTelegram(msg)).catch(() => { });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, agent: newAgent }));
        } catch (err) {
          console.error('[deploy-api] Error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Delete Agent API
    if (req.url === '/api/deploy/delete' && req.method === 'POST') {
      if (!requireAuth()) return;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { id, secretKey } = payload;
          if (!id) throw new Error('Agent ID is required');

          const configuredSecret = process.env.DELETE_SECRET_KEY;
          if (!configuredSecret) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Delete API security is not configured on server (DELETE_SECRET_KEY env is missing)' }));
            return;
          }

          if (secretKey !== configuredSecret) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden: Invalid secret key' }));
            return;
          }

          const { db } = await import('../db/connection.js');
          const { listBreeds } = await import('../db/agentDna.js');

          db.prepare('DELETE FROM agent_dna WHERE id = ?').run(id);
          broadcast('AGENT_DNA_UPDATE', listBreeds());

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Agent deleted successfully' }));
        } catch (err) {
          console.error('[delete-api] Error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Breed Agent API
    if (req.url === '/api/breed' && req.method === 'POST') {
      if (!requireAuth()) return;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { breedAgents, listBreeds } = await import('../db/agentDna.js');
          const newAgent = breedAgents(payload.parentAId, payload.parentBId, payload.childName);
          broadcast('AGENT_DNA_UPDATE', listBreeds());
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, agent: newAgent }));
        } catch (err) {
          console.error('[breed-api] Error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // List Agent on Marketplace API
    if (req.url === '/api/marketplace/list' && req.method === 'POST') {
      if (!requireAuth()) return;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { listAgentOnMarket, listBreeds } = await import('../db/agentDna.js');
          const updatedAgent = listAgentOnMarket(payload.id, payload.forSale, payload.salePriceSol, payload.royaltyPct);
          broadcast('AGENT_DNA_UPDATE', listBreeds());
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, agent: updatedAgent }));
        } catch (err) {
          console.error('[marketplace-list-api] Error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Clone Agent (Purchase) API
    if (req.url === '/api/marketplace/clone' && req.method === 'POST') {
      if (!requireAuth()) return;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { cloneAgent, listBreeds } = await import('../db/agentDna.js');
          const newAgent = cloneAgent(payload.parentDnaId, payload.cloneName, payload.ownerAddress);
          broadcast('AGENT_DNA_UPDATE', listBreeds());
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, agent: newAgent }));
        } catch (err) {
          console.error('[marketplace-clone-api] Error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Simple file server for exported DB ZIPs
    if (req.url.startsWith('/download/') && req.url.endsWith('.zip')) {
      const fileName = path.basename(req.url);
      const filePath = path.resolve('./', fileName);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404);
    res.end('Not found');
  });

  wss = new WebSocketServer({ server });

  server.listen(port, () => {
    console.log(`[ws-server] HTTP & WebSocket broadcasting on port ${port}`);
  });

  wss.on('connection', (ws, req) => {
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });

    // Send immediate initial state
    import('./stateManager.js').then(({ getMetrics, getStatuses, getLogHistory }) => {
      ws.send(JSON.stringify({ type: 'METRICS_UPDATE', payload: getMetrics() }));
      ws.send(JSON.stringify({ type: 'STATUS_UPDATE', payload: getStatuses() }));
      ws.send(JSON.stringify({ type: 'LOG_HISTORY', payload: getLogHistory() }));
    });

    // Send recent consciousness decisions on connect
    const url = new URL(req.url, 'http://localhost');
    const agentId = url.searchParams.get('agentId');

    if (agentId) {
      import('../db/connection.js').then(({ db }) => {
        try {
          const rows = db.prepare(`
            SELECT d.*, a.name as agent_name 
            FROM decision_logs d
            LEFT JOIN agent_dna a ON d.strategy_id = a.id
            WHERE d.strategy_id = ? 
            ORDER BY d.at_ms DESC 
            LIMIT 30
          `).all(agentId);

          const recentDecisions = rows.map(mapDbDecision);

          if (recentDecisions.length > 0) {
            ws.send(JSON.stringify({ type: 'CONSCIOUSNESS_HISTORY', payload: recentDecisions }));
          }
        } catch (err) {
          console.error('[wsServer] Failed to fetch agent decisions for WS history:', err.message);
        }
      });
    } else {
      const recentDecisions = getRecentDecisions(10);
      if (recentDecisions.length > 0) {
        ws.send(JSON.stringify({ type: 'CONSCIOUSNESS_HISTORY', payload: recentDecisions }));
      }
    }

    // Send agent DNA list on connect
    import('../db/agentDna.js').then(({ listBreeds }) => {
      try {
        const agents = listBreeds();
        ws.send(JSON.stringify({ type: 'AGENT_DNA_UPDATE', payload: agents }));
      } catch (_) { }
    }).catch(() => { });
  });

  // Forward consciousness stream decisions to all WS clients
  consciousnessStream.on('decision', (entry) => {
    broadcast('CONSCIOUSNESS_DECISION', entry);
  });
}

export function broadcast(type, payload) {
  if (!wss) return;
  const data = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}
