import { passesCopyGate, markHeld, unmarkHeld } from './copyGate.js';
import { executeJupiterSwap } from '../liveExecutor.js';
import { setCooldown } from '../utils/mintCooldown.js';
import { getEnabledWallets } from './walletRegistry.js';
import { db } from '../db/connection.js';
import { WSOL_MINT } from '../config.js';
import { now, json } from '../utils.js';

const COPY_SL_PERCENT = Number(process.env.COPYTRADE_SAFETY_SL || -25);
const COPY_TP_PERCENT = Number(process.env.COPYTRADE_TP_PERCENT || 100);
const COPY_TRAILING_ENABLED = process.env.COPYTRADE_TRAILING_ENABLED !== 'false' ? 1 : 0;
const COPY_TRAILING_PERCENT = Number(process.env.COPYTRADE_TRAILING_PERCENT || 15);
const COPY_SLIPPAGE_BPS = Number(process.env.COPYTRADE_SLIPPAGE_BPS || 1500);

export async function handleCopySignal(signal) {
  if (signal.action === 'BUY') {
    return handleCopyBuy(signal);
  } else if (signal.action === 'SELL') {
    return handleMirrorSell(signal);
  }
}

async function handleCopyBuy(signal) {
  const gate = passesCopyGate(signal);
  if (!gate.pass) {
    console.log(`[copytrade] SKIP ${signal.mint} — ${gate.reason}`);
    return;
  }

  // Determine copy size from wallet config
  const wallets = getEnabledWallets();
  const wallet = wallets.find(w => w.address === signal.wallet);
  const copySize = wallet?.copy_size_sol || Number(process.env.COPYTRADE_DEFAULT_SIZE_SOL || 0.1);

  console.log(`[copytrade] INSTANT COPY BUY ${signal.mint} size=${copySize} SOL`);

  try {
    const amountLamports = Math.floor(copySize * 1_000_000_000);
    const result = await executeJupiterSwap({
      inputMint: WSOL_MINT,
      outputMint: signal.mint,
      amount: amountLamports,
      useJito: process.env.COPYTRADE_USE_JITO !== 'false',
      priorityFee: process.env.COPYTRADE_PRIORITY_FEE || 'VeryHigh',
      slippageBps: COPY_SLIPPAGE_BPS,
    });

    markHeld(signal.mint);
    setCooldown(signal.mint, 'copytrade');

    // Open position with mirror-exit flag
    const resultInsert = db.prepare(`
      INSERT INTO dry_run_positions (
        mint, symbol, status, opened_at_ms, size_sol,
        tp_percent, sl_percent, trailing_enabled, trailing_percent, trailing_armed,
        strategy_id, execution_mode, entry_signature, token_amount_raw, snapshot_json,
        copied_from, mirror_exit
      ) VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, 0, 'copytrade', 'live', ?, ?, ?, ?, 1)
    `).run(
      signal.mint, signal.symbol || signal.mint.slice(0, 8), now(), copySize,
      COPY_TP_PERCENT, COPY_SL_PERCENT, COPY_TRAILING_ENABLED, COPY_TRAILING_PERCENT, 
      result.signature, result.outputAmount || null, json({ signal, result }),
      signal.wallet
    );
    
    // Telegram notify
    const { notifyCopyBuy } = await import('../telegram/copytrade.js');
    notifyCopyBuy(signal, copySize, result.signature);
  } catch (err) {
    console.error(`[copytrade] copy buy failed:`, err.message);
  }
}

async function handleMirrorSell(signal) {
  // Target wallet sold — find our matching position and exit
  const position = db.prepare(`SELECT * FROM dry_run_positions WHERE mint = ? AND status = 'open' AND strategy_id = 'copytrade' LIMIT 1`).get(signal.mint);
  if (!position || !position.mirror_exit) return;
  if (position.copied_from !== signal.wallet) return;  // only mirror the wallet we copied

  console.log(`[copytrade] MIRROR SELL ${signal.mint} — target wallet exited`);

  try {
    const amount = position.token_amount_raw || position.token_amount_est;
    if (!amount || Number(amount) <= 0) throw new Error('No token amount to sell');
    
    const result = await executeJupiterSwap({
      inputMint: signal.mint,
      outputMint: WSOL_MINT,
      amount: amount,
      useJito: process.env.COPYTRADE_USE_JITO !== 'false',
      priorityFee: process.env.COPYTRADE_PRIORITY_FEE || 'VeryHigh',
    });

    unmarkHeld(signal.mint);
    
    db.prepare(`
      UPDATE dry_run_positions
      SET status = 'closed', closed_at_ms = ?, exit_reason = 'MIRROR_EXIT', exit_signature = ?
      WHERE id = ?
    `).run(now(), result.signature, position.id);

    const { notifyMirrorSell } = await import('../telegram/copytrade.js');
    notifyMirrorSell(signal, position, result.signature);
  } catch (err) {
    console.error(`[copytrade] mirror sell failed:`, err.message);
  }
}
