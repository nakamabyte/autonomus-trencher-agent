import axios from 'axios';
import bs58 from 'bs58';
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import {
  JUPITER_API_KEY,
  JUPITER_SLIPPAGE_BPS,
  JUPITER_SWAP_BASE_URL,
  JSON_HEADERS,
  SOLANA_PRIVATE_KEY,
  getActiveRpcUrl,
  rotateRpcUrl,
} from './config.js';
import { setting } from './db/settings.js';

let liveWallet = null;
let solanaConnection = null;

function parseKeypair(secret) {
  const value = String(secret || '').trim();
  if (!value) return null;
  if (value.startsWith('[')) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value)));
  return Keypair.fromSecretKey(bs58.decode(value));
}

export function initLiveExecution() {
  const pk = setting('solana_private_key', SOLANA_PRIVATE_KEY);
  if (!pk) return;
  try {
    liveWallet = parseKeypair(pk);
    solanaConnection = new Connection(getActiveRpcUrl(), 'confirmed');
    console.log(`[live] wallet loaded ${liveWallet.publicKey.toBase58()} (RPC: ${getActiveRpcUrl()})`);
  } catch (err) {
    liveWallet = null;
    solanaConnection = null;
    console.log(`[live] wallet load failed: ${err.message}`);
  }
}

export function liveWalletPubkey() {
  return liveWallet?.publicKey?.toBase58() || null;
}

async function executeWithFailover(fn) {
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      if (!solanaConnection) {
        solanaConnection = new Connection(getActiveRpcUrl(), 'confirmed');
      }
      return await fn(solanaConnection);
    } catch (err) {
      attempts++;
      console.log(`[live] Connection error on RPC ${getActiveRpcUrl()}: ${err.message}`);
      if (attempts >= maxAttempts) {
        throw err;
      }
      rotateRpcUrl();
      solanaConnection = new Connection(getActiveRpcUrl(), 'confirmed');
    }
  }
}

export async function fetchLiveTokenBalance(mint) {
  if (!liveWallet) return null;
  return executeWithFailover(async (conn) => {
    const accounts = await conn.getParsedTokenAccountsByOwner(
      liveWallet.publicKey,
      { mint: new PublicKey(mint) },
      'confirmed',
    );
    return accounts.value[0]?.account?.data?.parsed?.info?.tokenAmount?.amount || null;
  }).catch((err) => {
    console.log(`[live] token balance ${mint.slice(0, 8)}... failed after retries: ${err.message}`);
    return null;
  });
}

export function requireLiveExecution() {
  if (!liveWallet) throw new Error('SOLANA_PRIVATE_KEY is required for live execution.');
  if (!JUPITER_API_KEY) throw new Error('JUPITER_API_KEY is required for live execution.');
}

export async function liveWalletBalanceLamports() {
  requireLiveExecution();
  return executeWithFailover(async (conn) => {
    return await conn.getBalance(liveWallet.publicKey, 'confirmed');
  });
}

async function jupiterOrder({ inputMint, outputMint, amount }) {
  requireLiveExecution();
  const url = new URL(`${JUPITER_SWAP_BASE_URL.replace(/\/$/, '')}/order`);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('taker', liveWallet.publicKey.toBase58());
  const res = await axios.get(url.toString(), {
    timeout: 20_000,
    headers: { ...JSON_HEADERS, 'x-api-key': JUPITER_API_KEY },
  });
  const order = res.data;
  if (order.errorCode || order.error) {
    throw new Error(`Jupiter order failed: ${order.errorMessage || order.error || order.errorCode}`);
  }
  return order;
}

function orderTransactionBase64(order) {
  return order?.transaction || order?.swapTransaction || null;
}

function signTransactionBase64(transactionBase64) {
  const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
  tx.sign([liveWallet]);
  return Buffer.from(tx.serialize()).toString('base64');
}

async function jupiterExecute(order, signedTransaction) {
  requireLiveExecution();
  const body = {
    signedTransaction,
    requestId: order.requestId,
  };
  const res = await axios.post(`${JUPITER_SWAP_BASE_URL.replace(/\/$/, '')}/execute`, body, {
    timeout: 30_000,
    headers: { ...JSON_HEADERS, 'content-type': 'application/json', 'x-api-key': JUPITER_API_KEY },
  });
  return res.data;
}

export async function executeJupiterSwap({ inputMint, outputMint, amount }) {
  const order = await jupiterOrder({ inputMint, outputMint, amount });
  const transaction = orderTransactionBase64(order);
  if (!transaction) throw new Error('Jupiter order did not include a transaction.');
  const signedTransaction = signTransactionBase64(transaction);
  const executed = await jupiterExecute(order, signedTransaction);
  if (executed?.status && executed.status !== 'Success') {
    throw new Error(`Jupiter execute failed: ${executed.error || executed.code || executed.status}`);
  }
  const signature = executed?.signature || executed?.txid || executed?.transactionId || null;
  if (!signature) {
    throw new Error(`Jupiter execute returned no signature (status: ${executed?.status || 'unknown'})`);
  }
  return {
    order,
    executed,
    signature,
    inputAmount: String(amount),
    outputAmount: String(executed?.outputAmountResult || executed?.totalOutputAmount || order?.outAmount || ''),
  };
}
