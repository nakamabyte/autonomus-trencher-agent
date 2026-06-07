/**
 * tokenParser.js
 * Parse token addresses and tickers from freeform Telegram messages.
 *
 * Priority:
 *   1. pump.fun links  — most reliable, direct CA
 *   2. Bare Solana CA  — 32-44 char base58
 *   3. Tickers ($XYZ)  — ambiguous, resolve via search_token separately
 */

const SOLANA_CA_REGEX  = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const PUMP_LINK_REGEX  = /pump\.fun\/(?:coin\/)?([1-9A-HJ-NP-Za-km-z]{32,44})/gi;
const TICKER_REGEX     = /\$([A-Za-z0-9]{2,10})\b/g;

// Common base58 false-positives to ignore (Solana program addresses etc.)
const BLOCKLIST = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

/**
 * Parse a Telegram message and extract token identifiers.
 *
 * @param {string} text - Raw message text
 * @returns {{ addresses: string[], tickers: string[] }}
 *   - addresses: deduplicated Solana CA strings (prioritized pump.fun links first)
 *   - tickers:   $TICKER strings if no CA found (need external resolve)
 */
export function parseTokenCall(text) {
  if (!text || typeof text !== 'string') return { addresses: [], tickers: [] };

  const found = new Set();

  // 1. pump.fun links — highest reliability
  let m;
  const pumpRegex = new RegExp(PUMP_LINK_REGEX.source, 'gi');
  while ((m = pumpRegex.exec(text)) !== null) {
    const ca = m[1];
    if (!BLOCKLIST.has(ca)) found.add(ca);
  }

  // 2. Bare contract addresses (32-44 chars base58)
  const caRegex = new RegExp(SOLANA_CA_REGEX.source, 'g');
  while ((m = caRegex.exec(text)) !== null) {
    const ca = m[0];
    if (ca.length >= 32 && !BLOCKLIST.has(ca)) {
      found.add(ca);
    }
  }

  // 3. Tickers ($XYZ) — only useful as fallback if no CA found
  const tickers = [];
  const tickerRegex = new RegExp(TICKER_REGEX.source, 'g');
  while ((m = tickerRegex.exec(text)) !== null) {
    tickers.push(m[1].toUpperCase());
  }

  return {
    addresses: [...found],
    tickers: found.size === 0 ? tickers : [],  // only emit tickers if no CA found
  };
}

/**
 * Quick sanity check: is this string a plausible Solana CA?
 * Does NOT verify on-chain — just format check.
 */
export function isValidSolanaAddress(str) {
  if (!str || str.length < 32 || str.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str) && !BLOCKLIST.has(str);
}
