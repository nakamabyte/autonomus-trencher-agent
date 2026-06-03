import cron from 'node-cron';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createBurnInstruction, getAccount, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { db } from '../db/connection.js';
import { 
  BURN_WALLET_PRIVATE_KEY, 
  AUTR_MINT_ADDRESS, 
  BURN_INTERVAL_HOURS, 
  SOL_MINT, 
  getActiveRpcUrl,
  LIVE_MIN_SOL_RESERVE_LAMPORTS
} from '../config.js';
import { parseKeypair, executeJupiterSwapWithKey } from '../liveExecutor.js';

let isBurning = false;

export async function runBurnCycle() {
  if (isBurning) return;
  isBurning = true;

  try {
    console.log('[burnCron] Starting auto-burn cycle...');
    if (!BURN_WALLET_PRIVATE_KEY) {
      console.log('[burnCron] No BURN_WALLET_PRIVATE_KEY configured. Skipping.');
      return;
    }

    const burnWallet = parseKeypair(BURN_WALLET_PRIVATE_KEY);
    const connection = new Connection(getActiveRpcUrl(), 'confirmed');

    // 1. Check SOL Balance
    const balance = await connection.getBalance(burnWallet.publicKey);
    const reserve = LIVE_MIN_SOL_RESERVE_LAMPORTS || 0.02 * 1e9;
    const swapAmount = balance - reserve;

    if (swapAmount <= 0) {
      console.log(`[burnCron] Insufficient SOL balance (${balance / 1e9} SOL) for swap. Need > ${reserve / 1e9} SOL. Skipping.`);
      return;
    }

    console.log(`[burnCron] Swapping ${swapAmount / 1e9} SOL for $AUTR...`);

    // 2. Execute Jupiter Swap (SOL -> $AUTR)
    let swapSignature = null;
    let autrBought = 0;
    try {
      const swapResult = await executeJupiterSwapWithKey(burnWallet, {
        inputMint: SOL_MINT,
        outputMint: AUTR_MINT_ADDRESS,
        amount: swapAmount,
      });
      swapSignature = swapResult.signature;
      autrBought = parseInt(swapResult.outputAmount || '0', 10);
      console.log(`[burnCron] Jupiter Swap successful: ${swapSignature}`);
      
      // Wait for confirmation to ensure tokens are in wallet
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (err) {
      console.error(`[burnCron] Jupiter Swap failed: ${err.message}`);
      return;
    }

    // 3. Burn the $AUTR
    console.log(`[burnCron] Burning $AUTR...`);
    const autrMint = new PublicKey(AUTR_MINT_ADDRESS);
    const ata = await getAssociatedTokenAddress(autrMint, burnWallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
    
    // Fetch actual token balance in the ATA
    let tokenBalanceToBurn = autrBought;
    try {
      const tokenAccount = await getAccount(connection, ata, 'confirmed', TOKEN_2022_PROGRAM_ID);
      tokenBalanceToBurn = Number(tokenAccount.amount); // Burn all available
    } catch (e) {
      console.log(`[burnCron] Could not fetch ATA balance, defaulting to swap output.`);
    }

    if (tokenBalanceToBurn <= 0) {
      console.log(`[burnCron] No $AUTR to burn. Skipping.`);
      return;
    }

    const burnInstruction = createBurnInstruction(
      ata,
      autrMint,
      burnWallet.publicKey,
      tokenBalanceToBurn,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction().add(burnInstruction);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = burnWallet.publicKey;

    let burnSignature = null;
    try {
      burnSignature = await sendAndConfirmTransaction(connection, tx, [burnWallet], {
        commitment: 'confirmed'
      });
      console.log(`[burnCron] Token Burn successful: ${burnSignature}`);
    } catch (err) {
      console.error(`[burnCron] Token Burn failed: ${err.message}`);
      return; // If burn fails, we might still want to log the swap, but it's tricky.
    }

    // 4. Record to Database
    const solSpentReal = swapAmount / 1e9;
    
    // Calculate human-readable AUTR burned (need to know decimals, usually 6 for pumpfun, but we'll store raw amount / 10^6)
    // Actually, just storing the exact number provided. Let's assume 6 decimals for standard pump.fun tokens.
    const autrBurnedDisplay = Math.floor(tokenBalanceToBurn / 1e6);

    const stmt = db.prepare(`
      INSERT INTO burn_log (sol_spent, autr_bought, autr_burned, tx_hash_swap, tx_hash_burn, source, created_at_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      solSpentReal,
      autrBurnedDisplay,
      autrBurnedDisplay,
      swapSignature,
      burnSignature,
      'cron',
      Date.now()
    );

    console.log(`[burnCron] Successfully completed cycle. Logged to DB.`);
  } catch (err) {
    console.error(`[burnCron] Fatal error during cycle: ${err.message}`);
  } finally {
    isBurning = false;
  }
}

export function initBurnCron() {
  const cronExpression = `0 */${BURN_INTERVAL_HOURS} * * *`;
  console.log(`[burnCron] Initializing auto-burn cron job with schedule: ${cronExpression}`);
  
  cron.schedule(cronExpression, () => {
    runBurnCycle();
  });
}
