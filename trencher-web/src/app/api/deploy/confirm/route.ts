import { Connection } from '@solana/web3.js'
// import { createAgent, logFee } from '@/lib/db'

// POST /api/deploy/confirm
export async function POST(req: Request) {
  try {
    const { signature, breed, dnaConfig } = await req.json()
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com')

    // 1. Confirm transaction first
    const latestBlockhash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash
    }, 'confirmed')

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
