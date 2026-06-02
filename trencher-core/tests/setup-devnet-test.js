import { Keypair } from '@solana/web3.js';

function setupDevnet() {
  console.log("Generating valid mock keys for testing...");
  
  // Generate a random wallet for the BURN_WALLET
  const burnWallet = Keypair.generate();
  
  // Generate another random Keypair to act as our Dummy Token Mint
  const dummyMint = Keypair.generate();
  
  console.log("\n========================================");
  console.log("SUCCESS! Please copy these values into your .env in trencher-core:");
  console.log("========================================");
  console.log(`AUTR_MINT_ADDRESS=${dummyMint.publicKey.toBase58()}`);
  console.log(`BURN_WALLET_PRIVATE_KEY=[${burnWallet.secretKey.toString()}]`);
  console.log("========================================\n");
  
  console.log("Note: Because this is a mock wallet, it has 0 SOL.");
  console.log("When you run test-burn.js, it will successfully read the keys, check the balance, and safely output '[burn] insufficient SOL for buyback, skipping', proving the script runs!");
}

setupDevnet();
