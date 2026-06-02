import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'

const VALID_BREEDS = [
  'scout', 'degen', 'canary', 'sniper', 'bunker', 'whale_tracker', 
  'drill_sergeant', 'mole', 'berserker', 'reaper', 'ghost', 'commander'
]

const DEPLOY_FEES: Record<string, number> = {
  scout: 0.025, degen: 0.025, canary: 0.025,
  sniper: 0.05, bunker: 0.05, whale_tracker: 0.05, drill_sergeant: 0.05,
  mole: 0.1, berserker: 0.1, reaper: 0.1, ghost: 0.1,
  commander: 0.2,
}

// POST /api/deploy/create-transaction
export async function POST(req: Request) {
  try {
    const { userAddress, breed, dnaConfig } = await req.json()

    console.log('Received transaction request:', { userAddress, breed });

    // Validate breed
    if (!VALID_BREEDS.includes(breed)) {
      return Response.json({ error: 'invalid breed' }, { status: 400 })
    }

    if (!userAddress) {
      return Response.json({ error: 'userAddress is required' }, { status: 400 })
    }

    // Load and validate public keys from env
    const burnWalletStr = process.env.BURN_WALLET_ADDRESS;
    const rewardPoolStr = process.env.REWARD_POOL_ADDRESS;
    const agentTreasuryStr = process.env.AGENT_TREASURY_ADDRESS;

    if (!burnWalletStr || !rewardPoolStr || !agentTreasuryStr) {
      console.error('Environment variables missing:', { burnWalletStr, rewardPoolStr, agentTreasuryStr });
      return Response.json({ error: 'Server environment wallets not configured' }, { status: 500 })
    }

    let BURN_WALLET: PublicKey;
    let REWARD_POOL: PublicKey;
    let AGENT_TREASURY: PublicKey;
    let userPubkey: PublicKey;

    try {
      BURN_WALLET = new PublicKey(burnWalletStr);
      REWARD_POOL = new PublicKey(rewardPoolStr);
      AGENT_TREASURY = new PublicKey(agentTreasuryStr);
      userPubkey = new PublicKey(userAddress);
    } catch (e: any) {
      console.error('Failed to parse public keys:', e);
      return Response.json({ error: 'Invalid public key configured on server or provided by user: ' + e.message }, { status: 400 })
    }

    const fee = DEPLOY_FEES[breed] || 0.05;
    const splitBurn = parseFloat(process.env.DEPLOY_FEE_SPLIT_BURN || '0.25');
    const splitReward = parseFloat(process.env.DEPLOY_FEE_SPLIT_REWARD || '0.50');

    const lamports = Math.floor(fee * LAMPORTS_PER_SOL);
    const burnAmount = Math.floor(lamports * splitBurn);
    const rewardAmount = Math.floor(lamports * splitReward);
    const treasuryAmount = lamports - burnAmount - rewardAmount;

    console.log('Creating transaction for fee splits:', {
      fee,
      lamports,
      burnAmount,
      rewardAmount,
      treasuryAmount
    });

    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com')
    const tx = new Transaction()

    // 25% to burn wallet
    if (burnAmount > 0) {
      tx.add(SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: BURN_WALLET,
        lamports: burnAmount,
      }))
    }

    // 50% to holder reward pool
    if (rewardAmount > 0) {
      tx.add(SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: REWARD_POOL,
        lamports: rewardAmount,
      }))
    }

    // 25% to agent treasury
    if (treasuryAmount > 0) {
      tx.add(SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: AGENT_TREASURY,
        lamports: treasuryAmount,
      }))
    }

    const { blockhash } = await connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = userPubkey

    // Serialize for frontend signing
    const txBase64 = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64')

    return Response.json({
      transaction: txBase64,
      fee,
      split: {
        burn: burnAmount / LAMPORTS_PER_SOL,
        reward_pool: rewardAmount / LAMPORTS_PER_SOL,
        agent_treasury: treasuryAmount / LAMPORTS_PER_SOL,
      }
    })
  } catch (error: any) {
    console.error('Error generating transaction:', error);
    return Response.json({ error: error.message }, { status: 500 })
  }
}
