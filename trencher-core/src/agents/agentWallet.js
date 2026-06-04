import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAgentWalletKey } from './executeAgentTrade.js'; // I'll need to export getAgentWalletKey from there

export async function getAgentWalletBalance(connection, agentWalletAddress) {
  try {
    const balance = await connection.getBalance(new PublicKey(agentWalletAddress));
    return balance / 1e9;
  } catch (err) {
    console.error(`[agentWallet] Error getting balance:`, err.message);
    return 0;
  }
}

export async function withdrawFromAgent(agent, db, connection, destinationAddress, amountSol) {
  const walletKey = getAgentWalletKey(db, agent.id);
  if (!walletKey) {
    throw new Error('Agent has no valid wallet key');
  }

  // Create transaction to transfer amountSol to destinationAddress
  // Normally we would sign with walletKey here and send via connection
  console.log(`[agentWallet] Mock withdrawing ${amountSol} SOL from ${agent.name} to ${destinationAddress}`);
  
  return { success: true, txHash: 'mock_tx_hash_123' };
}
