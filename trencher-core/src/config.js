import dotenv from 'dotenv';

dotenv.config();

export const APP_NAME = 'Trencher Agent';
export const DB_PATH = process.env.DB_PATH || './trencher-agent.sqlite';
export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const PUMP_AMM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const DISC_DIST_FEES = Buffer.from('a537817004b3ca28', 'hex');
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const SOL_MINT = 'So11111111111111111111111111111111111111111';

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
export const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID;
export const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
export const GMGN_API_KEY = process.env.GMGN_API_KEY;
export const GMGN_ENABLED = process.env.GMGN_ENABLED !== 'false';
export const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
export const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
export const SOLANA_RPC_URLS = (process.env.SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const SOLANA_WS_URLS = (process.env.SOLANA_WS_URL || `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

let currentRpcIndex = 0;
let currentWsIndex = 0;

export function getActiveRpcUrl() {
  return SOLANA_RPC_URLS[currentRpcIndex] || `https://api.mainnet-beta.solana.com`;
}

export function rotateRpcUrl() {
  if (SOLANA_RPC_URLS.length <= 1) return getActiveRpcUrl();
  currentRpcIndex = (currentRpcIndex + 1) % SOLANA_RPC_URLS.length;
  console.log(`[rpc-failover] Rotated RPC URL to index ${currentRpcIndex}: ${getActiveRpcUrl()}`);
  return getActiveRpcUrl();
}

export function getActiveWsUrl() {
  return SOLANA_WS_URLS[currentWsIndex] || `wss://api.mainnet-beta.solana.com`;
}

export function rotateWsUrl() {
  if (SOLANA_WS_URLS.length <= 1) return getActiveWsUrl();
  currentWsIndex = (currentWsIndex + 1) % SOLANA_WS_URLS.length;
  console.log(`[ws-failover] Rotated WebSocket URL to index ${currentWsIndex}: ${getActiveWsUrl()}`);
  return getActiveWsUrl();
}

export const SOLANA_RPC_URL = getActiveRpcUrl();
export const SOLANA_WS_URL = getActiveWsUrl();
export const JUPITER_SWAP_BASE_URL = process.env.JUPITER_SWAP_BASE_URL || 'https://api.jup.ag/swap/v2';
export const JUPITER_SLIPPAGE_BPS = Number(process.env.JUPITER_SLIPPAGE_BPS || 300);
export const LIVE_MIN_SOL_RESERVE_LAMPORTS = Math.floor(Number(process.env.LIVE_MIN_SOL_RESERVE || 0.02) * 1_000_000_000);
export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.anthropic.com/v1';
export const LLM_API_KEY = process.env.LLM_API_KEY || '';
export const LLM_MODEL = process.env.LLM_MODEL || 'claude-3-haiku-20240307';
export const LLM_MULTI_AGENT = process.env.LLM_MULTI_AGENT !== 'false';


export const LLM_T1_BASE_URL = process.env.LLM_T1_BASE_URL || 'https://api.deepseek.com/v1';
export const LLM_T1_API_KEY = process.env.LLM_T1_API_KEY || process.env.DEEPSEEK_API_KEY || '';
export const LLM_T1_MODEL = process.env.LLM_T1_MODEL || 'deepseek-chat';
export const LLM_T1_CONFIDENCE_PASS = Number(process.env.LLM_T1_CONFIDENCE_PASS || 0.75);
export const LLM_T1_CONFIDENCE_BUY = Number(process.env.LLM_T1_CONFIDENCE_BUY || 0.80);

export const LLM_T2_BASE_URL = process.env.LLM_T2_BASE_URL || 'https://api.x.ai/v1';
export const LLM_T2_API_KEY = process.env.LLM_T2_API_KEY || process.env.GROK_API_KEY || '';
export const LLM_T2_MODEL = process.env.LLM_T2_MODEL || 'grok-4.3';
export const LLM_T2_CONFIDENCE_BUY = Number(process.env.LLM_T2_CONFIDENCE_BUY || 0.75);

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
export const GROK_API_KEY = process.env.GROK_API_KEY || '';

export const GRADUATED_POLL_MS = Number(process.env.GRADUATED_POLL_MS || 30_000);
export const GRADUATED_LOOKBACK_MS = Number(process.env.GRADUATED_LOOKBACK_MS || 2 * 60 * 60 * 1000);
export const TRENDING_POLL_MS = Number(process.env.TRENDING_POLL_MS || 60_000);
export const TRENDING_LOOKBACK_MS = Number(process.env.TRENDING_LOOKBACK_MS || 10 * 60 * 1000);
export const GMGN_CACHE_TTL_MS = Number(process.env.GMGN_CACHE_TTL_MS || 5 * 60 * 1000);
export const POSITION_CHECK_MS = Number(process.env.POSITION_CHECK_MS || 10_000);
export const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 60_000);
export const ENABLE_LLM = process.env.ENABLE_LLM !== 'false';
export const ENABLE_GENERAL_SCREENING = process.env.ENABLE_GENERAL_SCREENING !== 'false';
export const MINT_COOLDOWN_MS = Number(process.env.MINT_COOLDOWN_MS || 2 * 60 * 60 * 1000);
export const SIGNAL_SERVER_URL = process.env.SIGNAL_SERVER_URL || 'http://localhost:3456';
export const SIGNAL_SERVER_KEY = process.env.SIGNAL_SERVER_KEY || '';
export const SIGNAL_POLL_MS = Number(process.env.SIGNAL_POLL_MS || 30_000);

// Burn wallet configurations
export const BURN_WALLET_PRIVATE_KEY = process.env.BURN_WALLET_PRIVATE_KEY || '';
export const AUTR_MINT_ADDRESS = process.env.AUTR_MINT_ADDRESS || 'BuFWUxhWGJWsCCp5wEtww9YLazfUHMUJkQsuje1gpump';
export const BURN_INTERVAL_HOURS = Number(process.env.BURN_INTERVAL_HOURS || 6);

export const JSON_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// x402 Signal Economy Configurations
export const X402_PORT = process.env.X402_PORT || 4002;
export const X402_TREASURY_KEY = process.env.X402_TREASURY_KEY || ''; // Revenue wallet
export const X402_PRICES_USDC = {
  'risk-check': 0.05,
  'due-diligence': 0.25,
  'caller-trust': 0.10,
  'sentiment-read': 0.05,
  'market-regime': 0.02,
};
export const X402_FREE_CALLS_PER_DAY = Number(process.env.X402_FREE_CALLS_PER_DAY || 3);

// Pay.sh configurations
export const PAYSH_SPEND_WALLET_KEY = process.env.PAYSH_SPEND_WALLET_KEY || '';
export const API_DAILY_SPEND_CAP_USDC = Number(process.env.API_DAILY_SPEND_CAP_USDC || 5.0);
export const API_MAX_PER_CALL_USDC = Number(process.env.API_MAX_PER_CALL_USDC || 0.50);

// Hatcher Labs Integration
export const ENABLE_HATCHER_PILOT = process.env.ENABLE_HATCHER_PILOT === 'true';
export const HATCHER_PARTNER_API_KEY = process.env.HATCHER_PARTNER_API_KEY || '';
export const HATCHER_AGENT_PUBKEY = process.env.HATCHER_AGENT_PUBKEY || '';
export const HATCHER_AGENT_ID = process.env.HATCHER_AGENT_ID || '';
export const HATCHER_WEBHOOK_URL = process.env.HATCHER_WEBHOOK_URL || '';

export function validateConfig() {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required.');
  if (!TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is required.');
  if (!HELIUS_API_KEY && (!process.env.SOLANA_RPC_URL || !process.env.SOLANA_WS_URL)) {
    throw new Error('HELIUS_API_KEY is required unless SOLANA_RPC_URL and SOLANA_WS_URL are set.');
  }
  if (GMGN_ENABLED && !GMGN_API_KEY) throw new Error('GMGN_API_KEY is required unless GMGN_ENABLED=false.');
}
