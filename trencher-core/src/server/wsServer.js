import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { consciousnessStream, getRecentDecisions } from '../consciousness/decisionLog.js';

let wss;
const clients = new Set();

export function startWsServer(port = 4001) {
  const server = http.createServer((req, res) => {
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
