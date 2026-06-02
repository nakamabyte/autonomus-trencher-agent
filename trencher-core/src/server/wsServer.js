import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { consciousnessStream, getRecentDecisions } from '../consciousness/decisionLog.js';

let wss;
const clients = new Set();

export function startWsServer(port = 4001) {
  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
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
