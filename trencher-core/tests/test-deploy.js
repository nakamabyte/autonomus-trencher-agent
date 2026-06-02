import { Connection, Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('\n========================================================');
  console.log('🚀 TRENCHER AGENT - DEPLOY PAYMENT TEST 🚀');
  console.log('========================================================');
  
  console.log('[SYSTEM] Loading environment variables...');
  
  // Provide valid Base58 fallback for dummy placeholders so the test can run successfully
  const dummyPk = () => Keypair.generate().publicKey.toBase58();
  if (!process.env.BURN_WALLET_ADDRESS || process.env.BURN_WALLET_ADDRESS.includes('_')) process.env.BURN_WALLET_ADDRESS = dummyPk();
  if (!process.env.REWARD_POOL_ADDRESS || process.env.REWARD_POOL_ADDRESS.includes('_')) process.env.REWARD_POOL_ADDRESS = dummyPk();
  if (!process.env.AGENT_TREASURY_ADDRESS || process.env.AGENT_TREASURY_ADDRESS.includes('_')) process.env.AGENT_TREASURY_ADDRESS = dummyPk();
  if (!process.env.OPS_WALLET_ADDRESS || process.env.OPS_WALLET_ADDRESS.includes('_')) process.env.OPS_WALLET_ADDRESS = dummyPk();
  if (!process.env.AUTR_MINT_ADDRESS || process.env.AUTR_MINT_ADDRESS.includes('_')) process.env.AUTR_MINT_ADDRESS = dummyPk();

  console.log(`[SYSTEM] Burn Wallet      : ${process.env.BURN_WALLET_ADDRESS}`);
  console.log(`[SYSTEM] Reward Pool      : ${process.env.REWARD_POOL_ADDRESS}`);
  console.log(`[SYSTEM] Agent Treasury   : ${process.env.AGENT_TREASURY_ADDRESS}`);
  console.log(`[SYSTEM] Ops Wallet       : ${process.env.OPS_WALLET_ADDRESS}`);
  
  console.log('\n[NETWORK] Initializing Solana Connection...');
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
  
  console.log('\n[PROCESS] Importing deployPayment module dynamically...');
  const { createDeployTransaction } = await import('../src/payments/deployPayment.js');
  
  // Create a mock user
  const dummyUser = Keypair.generate();
  console.log(`[PROCESS] Simulating User Wallet: ${dummyUser.publicKey.toBase58()}`);
  
  const breed = 'sniper'; // 0.05 SOL tier
  console.log(`[PROCESS] Selected Breed: ${breed.toUpperCase()}`);
  
  console.log('--------------------------------------------------------\n');
  
  try {
    const { transaction, fee, split } = await createDeployTransaction(connection, dummyUser.publicKey, breed);
    
    console.log('\n--------------------------------------------------------');
    console.log('✅ TEST PASSED: Deploy Transaction Generated!');
    console.log(`💰 Total Deploy Fee: ${fee} SOL`);
    console.log('\n📊 Fee Split Breakdown:');
    console.log(`   🎁 Holder Rewards (50%): ${split.reward_pool} SOL`);
    console.log(`   🔥 Burn $AUTR     (25%): ${split.burn} SOL`);
    console.log(`   🏦 Agent Treasury (25%): ${split.agent_treasury} SOL`);
    console.log(`\n📝 Transaction contains ${transaction.instructions.length} transfer instructions.`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED: An error occurred during execution:');
    console.error(err);
    console.log('========================================================\n');
  }
}

run();
