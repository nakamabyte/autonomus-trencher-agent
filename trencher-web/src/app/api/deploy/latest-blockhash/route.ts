import { Connection } from '@solana/web3.js'

export async function GET() {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
      process.env.NEXT_PUBLIC_RPC_URL || 
      'https://api.devnet.solana.com'
    )
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    return Response.json({ blockhash, lastValidBlockHeight })
  } catch (error: any) {
    console.error('Error fetching blockhash from server:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
