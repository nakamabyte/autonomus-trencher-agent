import { WebSocketServer } from 'ws';
import { consciousnessStream, getRecentDecisions } from './decisionLog.js';

// ─── Config ────────────────────────────────────────────────────────
// NOTE: Consciousness data also flows through the main wsServer (port 4001)
// via CONSCIOUSNESS_DECISION message type. This standalone server (default 4002)
// is for external consumers (OBS overlays, dedicated streams, etc.)
const DEFAULT_PORT = 4002;
const HISTORY_SEND_ON_CONNECT = 10;

// ─── MessageFormatter ─────────────────────────────────────────────
/**
 * Formats all outgoing WebSocket messages with a consistent envelope.
 * {type, data, ts}
 */
class MessageFormatter {
  static decision(entry) {
    return JSON.stringify({ type: 'decision', data: entry, ts: Date.now() });
  }

  static history(entries) {
    return JSON.stringify({ type: 'history', data: entries, ts: Date.now() });
  }

  static ping() {
    return JSON.stringify({ type: 'ping', ts: Date.now() });
  }
}

// ─── ClientManager ────────────────────────────────────────────────
/**
 * Manages the Set of connected WebSocket clients.
 * Reusable: can be extended for future message types (alerts, stats, etc.)
 */
class ClientManager {
  constructor() {
    this._clients = new Set();
  }

  add(ws) {
    this._clients.add(ws);
  }

  remove(ws) {
    this._clients.delete(ws);
  }

  get count() {
    return this._clients.size;
  }

  /**
   * Broadcast a pre-serialized message string to all OPEN clients.
   * @param {string} message - JSON string
   */
  broadcast(message) {
    for (const client of this._clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(message);
      }
    }
  }

  /**
   * Close all connections gracefully.
   */
  closeAll() {
    for (const client of this._clients) {
      try { client.terminate(); } catch (_) {}
    }
    this._clients.clear();
  }
}

// ─── Module-level state ────────────────────────────────────────────
let wss = null;
const clients = new ClientManager();

// ─── Lifecycle: startStreamServer ─────────────────────────────────
/**
 * Start the WebSocket stream server.
 * Port is read from env CONSCIOUSNESS_WS_PORT (default: 4001).
 *
 * @returns {WebSocketServer}
 */
export function startStreamServer() {
  if (wss) {
    console.warn('[consciousness] streamServer already running — ignoring duplicate start');
    return wss;
  }

  const port = Number(process.env.CONSCIOUSNESS_WS_PORT) || DEFAULT_PORT;

  wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`[consciousness] WebSocket stream server listening on ws://localhost:${port}`);
  });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress || 'unknown';
    clients.add(ws);
    console.log(`[consciousness] client connected (${ip}) — total: ${clients.count}`);

    // Send recent history immediately on connect
    const history = getRecentDecisions(HISTORY_SEND_ON_CONNECT);
    ws.send(MessageFormatter.history(history));

    ws.on('close', () => {
      clients.remove(ws);
      console.log(`[consciousness] client disconnected — remaining: ${clients.count}`);
    });

    ws.on('error', (err) => {
      console.error(`[consciousness] client error: ${err.message}`);
      clients.remove(ws);
    });
  });

  wss.on('error', (err) => {
    console.error(`[consciousness] WebSocket server error: ${err.message}`);
  });

  // Forward every decision event → broadcast to all clients
  consciousnessStream.on('decision', (entry) => {
    clients.broadcast(MessageFormatter.decision(entry));
  });

  return wss;
}

// ─── Lifecycle: stopStreamServer ──────────────────────────────────
/**
 * Gracefully stop the WebSocket stream server.
 * Closes all client connections, then shuts down the server.
 *
 * @returns {Promise<void>}
 */
export function stopStreamServer() {
  return new Promise((resolve, reject) => {
    if (!wss) {
      resolve();
      return;
    }

    // Remove the decision listener to avoid dangling references
    consciousnessStream.removeAllListeners('decision');

    clients.closeAll();

    wss.close((err) => {
      if (err) {
        console.error('[consciousness] error closing stream server:', err.message);
        reject(err);
      } else {
        console.log('[consciousness] stream server stopped');
        resolve();
      }
      wss = null;
    });
  });
}
