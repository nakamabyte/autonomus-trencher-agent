import WebSocket from 'ws';
import { getWalletSet } from './walletRegistry.js';
import { handleCopySignal } from './copyExecutor.js';
import { WSOL_MINT } from '../config.js';

let ws;
let walletSet = new Set();
let reconnectTimer;

export function startWalletWatcher() {
  if (process.env.COPYTRADE_ENABLED !== 'true') return;
  
  walletSet = getWalletSet();
  // Refresh wallet set every 60s
  setInterval(() => { walletSet = getWalletSet(); }, 60000);
  connect();
}

function connect() {
  if (!process.env.HELIUS_API_KEY) {
    console.error('[copytrade] HELIUS_API_KEY missing, watcher not starting');
    return;
  }
  const HELIUS_WS = `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  ws = new WebSocket(HELIUS_WS);

  ws.on('open', () => {
    console.log(`[copytrade] watching ${walletSet.size} smart money wallets via Helius`);
    if (walletSet.size > 0) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'transactionSubscribe',
        params: [
          { accountInclude: Array.from(walletSet) },
          { commitment: 'processed', encoding: 'jsonParsed', transactionDetails: 'full' }
        ]
      }));
    }
  });

  ws.on('message', (data) => {
    const t0 = Date.now();
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) return; // sub confirmation
      
      const tx = msg?.params?.result;
      if (!tx || !tx.transaction) return;

      const parsed = parseSwapTx(tx);
      if (!parsed) return;

      if (!walletSet.has(parsed.wallet)) return;

      const latency = Date.now() - t0;
      console.log(`[copytrade] ${parsed.action} detected from ${parsed.wallet.slice(0,8)} in ${latency}ms`);

      handleCopySignal(parsed);
    } catch (err) {
      console.error('[copytrade] parse error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[copytrade] ws closed, reconnecting in 3s');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  });
  
  ws.on('error', (err) => console.error('[copytrade] ws error:', err.message));
}

function parseSwapTx(tx) {
  try {
    const meta = tx.transaction.meta;
    if (!meta || meta.err) return null; // ignore failed txs

    const accountKeys = tx.transaction.transaction.message.accountKeys.map(k => typeof k === 'string' ? k : k.pubkey);
    
    // Find the wallet from our tracked set that is involved in this tx
    const wallet = accountKeys.find(key => walletSet.has(key));
    if (!wallet) return null;

    const walletIndex = accountKeys.indexOf(wallet);
    
    // Check SOL balance changes
    const preSol = meta.preBalances[walletIndex] || 0;
    const postSol = meta.postBalances[walletIndex] || 0;
    const solDiff = postSol - preSol;

    // Check Token balance changes
    const preTokens = meta.preTokenBalances || [];
    const postTokens = meta.postTokenBalances || [];

    const walletPreTokens = preTokens.filter(t => t.owner === wallet);
    const walletPostTokens = postTokens.filter(t => t.owner === wallet);

    // Build a map of mint -> diff
    const tokenDiffs = new Map();

    for (const pre of walletPreTokens) {
      if (pre.mint === WSOL_MINT) continue; // handle wSOL same as SOL loosely
      tokenDiffs.set(pre.mint, -(Number(pre.uiTokenAmount.uiAmount) || 0));
    }

    for (const post of walletPostTokens) {
      if (post.mint === WSOL_MINT) continue;
      const current = tokenDiffs.get(post.mint) || 0;
      tokenDiffs.set(post.mint, current + (Number(post.uiTokenAmount.uiAmount) || 0));
    }

    // Now determine if it's a swap based on solDiff and tokenDiffs
    // A BUY is: solDiff < 0 AND a token diff is > 0
    // A SELL is: solDiff > 0 AND a token diff is < 0

    let action = null;
    let targetMint = null;
    let tokenAmount = 0;

    for (const [mint, diff] of tokenDiffs.entries()) {
      // Find the most significant token change if multiple
      if (solDiff < -5000000 && diff > 0) { // dropped at least 0.005 SOL
        action = 'BUY';
        targetMint = mint;
        tokenAmount = diff;
        break; // found the token bought
      } else if (solDiff > 5000000 && diff < 0) { // gained at least 0.005 SOL
        action = 'SELL';
        targetMint = mint;
        tokenAmount = diff;
        break; // found the token sold
      }
    }

    if (!action || !targetMint) return null;

    return {
      wallet,
      action,
      mint: targetMint,
      amount_sol: Math.abs(solDiff) / 1e9,
      token_amount: Math.abs(tokenAmount)
    };
  } catch (e) {
    return null;
  }
}
