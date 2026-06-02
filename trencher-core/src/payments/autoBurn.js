import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  createBurnInstruction, getAssociatedTokenAddress
} from '@solana/spl-token'

const AUTR_MINT = new PublicKey(process.env.AUTR_MINT_ADDRESS)
const BURN_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.BURN_WALLET_PRIVATE_KEY))
)

export async function executeBuybackAndBurn(connection) {
  // Step 1: Check burn wallet SOL balance
  const balance = await connection.getBalance(BURN_KEYPAIR.publicKey)
  const availableSol = balance / 1e9 - 0.01  // keep 0.01 SOL for fees

  if (availableSol < 0.01) {
    console.log('[burn] insufficient SOL for buyback, skipping')
    return null
  }

  console.log(`[burn] initiating buyback: ${availableSol.toFixed(4)} SOL`)

  // Step 2: Swap SOL → $AUTR via Jupiter
  const quoteRes = await fetch(
    `https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${AUTR_MINT.toBase58()}&amount=${Math.floor(availableSol * 1e9)}&slippageBps=300`
  )
  const quote = await quoteRes.json()

  if (!quote || quote.error) {
    console.error('[burn] Jupiter quote failed:', quote?.error)
    return null
  }

  const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: BURN_KEYPAIR.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    })
  })
  const swap = await swapRes.json()

  // Sign and send swap transaction
  // ... standard Jupiter swap execution ...

  const autrAmount = parseInt(quote.outAmount)
  console.log(`[burn] swapped ${availableSol.toFixed(4)} SOL → ${autrAmount} $AUTR`)

  // Step 3: Burn the $AUTR
  const autrAta = await getAssociatedTokenAddress(
    AUTR_MINT, BURN_KEYPAIR.publicKey
  )

  const burnIx = createBurnInstruction(
    autrAta,
    AUTR_MINT,
    BURN_KEYPAIR.publicKey,
    autrAmount
  )

  // ... execute burn transaction ...

  console.log(`[burn] burned ${autrAmount} $AUTR`)

  return {
    sol_spent: availableSol,
    autr_bought: autrAmount,
    autr_burned: autrAmount,
    timestamp: Date.now(),
  }
}
