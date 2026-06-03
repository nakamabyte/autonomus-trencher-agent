import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { consciousnessStream, getRecentDecisions } from '../consciousness/decisionLog.js';

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

    // Deploy Agent API
    if (req.url === '/api/deploy' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { createDna, listBreeds } = await import('../db/agentDna.js');
          const newAgent = createDna(payload);
          broadcast('AGENT_DNA_UPDATE', listBreeds());
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
  
  wss.on('connection', (ws) => {
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
    const recentDecisions = getRecentDecisions(10);
    if (recentDecisions.length > 0) {
      ws.send(JSON.stringify({ type: 'CONSCIOUSNESS_HISTORY', payload: recentDecisions }));
    }

    // Send agent DNA list on connect
    import('../db/agentDna.js').then(({ listBreeds }) => {
      try {
        const agents = listBreeds();
        ws.send(JSON.stringify({ type: 'AGENT_DNA_UPDATE', payload: agents }));
      } catch (_) {}
    }).catch(() => {});
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
