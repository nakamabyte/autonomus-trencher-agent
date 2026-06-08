import { Connection } from '@solana/web3.js'
// import { createAgent, logFee } from '@/lib/db'

// POST /api/deploy/confirm
export async function POST(req: Request) {
  try {
    const { signature, breed, dnaConfig } = await req.json()
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com')

    // 1. Wait for confirmation via signature status polling
    let confirmed = false;
    const start = Date.now();
    while (Date.now() - start < 90000) { // 90 seconds timeout
      const statusRes = await connection.getSignatureStatus(signature);
      const status = statusRes?.value;
      if (status && (status.confirmationStatus === 'processed' || status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
        confirmed = true;
        break;
      }
      if (status && status.err) {
        console.error('Transaction error status:', status.err);
        return Response.json({ error: `Transaction failed: ${JSON.stringify(status.err)}` }, { status: 400 })
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!confirmed) {
      return Response.json({ error: 'Transaction confirmation timeout. Please check your explorer.' }, { status: 408 })
    }

    // 2. Verify transaction on-chain
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    
    if (!tx) {
      console.error('Transaction not found on-chain:', signature);
      return Response.json({ error: 'Transaction confirmation failed / transaction not found' }, { status: 400 })
    }

    // 2. Verify correct amounts sent to correct wallets
    // ... verification logic ...

    // 3. Create agent in database
    // const agentId = await createAgent(breed, dnaConfig, signature)
    const agentId = 'mock_agent_id_' + Date.now()

    // 4. Log fee
    // await logFee(signature, breed, fee)

    return Response.json({ agentId, status: 'deployed' })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
