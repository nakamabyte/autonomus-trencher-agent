const WebSocket = require('ws');

const PUMPFUN_WS = 'wss://pumpportal.fun/api/data';

let ws;
let onNewToken = null;

function startFreshLaunchListener(callback) {
  onNewToken = callback;
  connect();
}

function connect() {
  ws = new WebSocket(PUMPFUN_WS);

  ws.on('open', () => {
    console.log('[fresh-launch] connected to pump.fun new token feed');
    // Subscribe to new token creation events
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
  });

  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      if (event.txType === 'create') {
        handleNewToken(event);
      }
    } catch (err) {
      console.error('[fresh-launch] parse error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[fresh-launch] closed, reconnecting in 5s');
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error('[fresh-launch] ws error:', err.message);
  });
}

function handleNewToken(event) {
  // Build minimal candidate from creation event
  const token = {
    mint: event.mint,
    symbol: event.symbol,
    name: event.name,
    creator: event.traderPublicKey,
    initial_buy_sol: event.solAmount || 0,
    market_cap_sol: event.marketCapSol || 0,
    uri: event.uri,
    created_at_ms: Date.now(),
    source: 'fresh_launch'
  };

  if (onNewToken) onNewToken(token);
}

module.exports = {
  startFreshLaunchListener
};
