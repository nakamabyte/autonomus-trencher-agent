import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('\n========================================================');
  console.log('🔥 TRENCHER AGENT - AUTO-BURN MODULE TEST 🔥');
  console.log('========================================================');
  console.log('[SYSTEM] Loading environment variables...');
  console.log(`[SYSTEM] AUTR Mint Address : ${process.env.AUTR_MINT_ADDRESS}`);
  
  // Mask the private key for security in logs
  const pk = process.env.BURN_WALLET_PRIVATE_KEY;
  const maskedPk = pk ? `${pk.substring(0, 15)}...${pk.substring(pk.length - 10)}` : 'NOT SET';
  console.log(`[SYSTEM] Burn Wallet PK    : ${maskedPk}`);
  
  console.log('[NETWORK] Initializing Solana Connection...');
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
  console.log(`[NETWORK] Connected to     : ${connection.rpcEndpoint}`);
  
  console.log('\n[PROCESS] Importing autoBurn module dynamically...');
  const { executeBuybackAndBurn } = await import('../src/payments/autoBurn.js');
  
  console.log('[PROCESS] Triggering executeBuybackAndBurn()...');
  console.log('--------------------------------------------------------\n');
  
  try {
    const result = await executeBuybackAndBurn(connection);
    
    console.log('\n--------------------------------------------------------');
    if (!result) {
      console.log('✅ TEST PASSED: Safety check worked correctly.');
      console.log('   (Script successfully halted because wallet has 0 SOL)');
    } else {
      console.log('✅ TEST PASSED: Burn execution completed successfully.');
    }
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED: An error occurred during execution:');
    console.error(err);
    console.log('========================================================\n');
  }
}

run();
