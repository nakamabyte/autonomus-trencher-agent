import {
  Connection, PublicKey, Transaction,
  SystemProgram, LAMPORTS_PER_SOL
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress, createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'

const AUTR_MINT = new PublicKey(process.env.AUTR_MINT_ADDRESS)
const BURN_WALLET = new PublicKey(process.env.BURN_WALLET_ADDRESS)
const REWARD_POOL = new PublicKey(process.env.REWARD_POOL_ADDRESS)
const AGENT_TREASURY = new PublicKey(process.env.AGENT_TREASURY_ADDRESS)
const OPS_WALLET = new PublicKey(process.env.OPS_WALLET_ADDRESS)

const DEPLOY_FEES = {
  scout: 0.025,
  degen: 0.025,
  canary: 0.025,
  sniper: 0.05,
  bunker: 0.05,
  whale_tracker: 0.05,
  drill_sergeant: 0.05,
  mole: 0.1,
  berserker: 0.1,
  reaper: 0.1,
  ghost: 0.1,
  commander: 0.2,
}

const BREED_FEE = 0.05
const MUTATION_FEE = 0.025
const LISTING_FEE = 0.01

// Fee split ratios (Model C)
const SPLIT = {
  burn: parseFloat(process.env.DEPLOY_FEE_SPLIT_BURN || '0.25'),
  reward_pool: parseFloat(process.env.DEPLOY_FEE_SPLIT_REWARD || '0.25'),
  agent_treasury: parseFloat(process.env.DEPLOY_FEE_SPLIT_TREASURY || '0.25'),
  operations: parseFloat(process.env.DEPLOY_FEE_SPLIT_OPS || '0.25'),
}

export function getDeployFee(breed) {
  return DEPLOY_FEES[breed] || 0.05
}

export async function createDeployTransaction(connection, userPubkey, breed) {
  const fee = getDeployFee(breed)
  const lamports = Math.floor(fee * LAMPORTS_PER_SOL)

  const burnAmount = Math.floor(lamports * SPLIT.burn)
  const rewardAmount = Math.floor(lamports * SPLIT.reward_pool)
  const treasuryAmount = Math.floor(lamports * SPLIT.agent_treasury)
  const opsAmount = lamports - burnAmount - rewardAmount - treasuryAmount

  const tx = new Transaction()

  // 25% to burn wallet (will be used to buy and burn $AUTR)
  tx.add(SystemProgram.transfer({
    fromPubkey: userPubkey,
    toPubkey: BURN_WALLET,
    lamports: burnAmount,
  }))

  // 25% to holder reward pool
  tx.add(SystemProgram.transfer({
    fromPubkey: userPubkey,
    toPubkey: REWARD_POOL,
    lamports: rewardAmount,
  }))

  // 25% to agent treasury (compounds into trading)
  tx.add(SystemProgram.transfer({
    fromPubkey: userPubkey,
    toPubkey: AGENT_TREASURY,
    lamports: treasuryAmount,
  }))

  // 25% to operations wallet
  tx.add(SystemProgram.transfer({
    fromPubkey: userPubkey,
    toPubkey: OPS_WALLET,
    lamports: opsAmount,
  }))

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = userPubkey

  return { transaction: tx, fee, split: {
    burn: burnAmount / LAMPORTS_PER_SOL,
    reward_pool: rewardAmount / LAMPORTS_PER_SOL,
    agent_treasury: treasuryAmount / LAMPORTS_PER_SOL,
    operations: opsAmount / LAMPORTS_PER_SOL,
  }}
}
