import { isOnCooldown } from '../utils/mintCooldown.js';

// In-memory caches for speed
const bundlerCache = new Map();  // mint -> { rate, ts }
const blacklist = new Set();      // known rug mints
const heldPositions = new Set();  // mints currently held

const BUNDLER_CACHE_TTL = 5 * 60 * 1000;

export function passesCopyGate(signal) {
  const { mint, wallet, action } = signal;

  // Only gate BUYs — sells are handled by mirror exit
  if (action !== 'BUY') return { pass: true };

  // RULE 1: not already holding this mint
  if (heldPositions.has(mint)) {
    return { pass: false, reason: 'already holding' };
  }

  // RULE 2: not blacklisted
  if (blacklist.has(mint)) {
    return { pass: false, reason: 'blacklisted mint' };
  }

  // RULE 3: cooldown clear
  if (isOnCooldown(mint)) {
    return { pass: false, reason: 'cooldown active' };
  }

  // RULE 4: bundler rate (use cache, skip if not cached — speed priority)
  const cached = bundlerCache.get(mint);
  if (cached && (Date.now() - cached.ts) < BUNDLER_CACHE_TTL) {
    if (cached.rate > 0.20) {
      return { pass: false, reason: `bundler ${cached.rate} too high` };
    }
  }

  return { pass: true };
}

export function markHeld(mint) { heldPositions.add(mint); }
export function unmarkHeld(mint) { heldPositions.delete(mint); }
export function addBlacklist(mint) { blacklist.add(mint); }
export function cacheBundler(mint, rate) {
  bundlerCache.set(mint, { rate, ts: Date.now() });
}
