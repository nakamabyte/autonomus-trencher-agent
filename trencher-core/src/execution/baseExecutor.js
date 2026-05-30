import { createWalletClient, createPublicClient, http, parseEther, erc20Abi, maxUint256 } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { setting } from '../db/settings.js'

const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481'  // Base Uniswap V3

// Minimal ABI for exactInputSingle
const SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        internalType: 'struct ISwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

let walletClient = null;
let publicClient = null;
let account = null;

export function reloadBaseClients() {
  walletClient = null;
  publicClient = null;
  account = null;
}

function getClients() {
  if (!walletClient) {
    const pk = setting('base_private_key', process.env.BASE_PRIVATE_KEY);
    const rpc = setting('base_rpc_url', process.env.BASE_RPC_URL);
    if (!pk || !rpc) {
      throw new Error("Missing BASE_PRIVATE_KEY or BASE_RPC_URL (set via .env or bot)");
    }
    account = privateKeyToAccount(pk)
    walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpc)
    })
    publicClient = createPublicClient({
      chain: base,
      transport: http(rpc)
    })
  }
  return { walletClient, publicClient, account };
}

export async function executeBaseSwap({ tokenAddress, side, amount }) {
  if (side === 'buy') {
    return executeBuyBase(tokenAddress, amount)
  } else {
    return executeSellBase(tokenAddress, amount)
  }
}

async function executeBuyBase(tokenAddress, amountEth) {
  const { walletClient, account } = getClients();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

  const tx = await walletClient.writeContract({
    address: UNISWAP_V3_ROUTER,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: '0x4200000000000000000000000000000000000006',  // WETH on Base
      tokenOut: tokenAddress,
      fee: 10000,  // 1% pool (most liquid for new tokens)
      recipient: account.address,
      deadline,
      amountIn: parseEther(amountEth.toString()),
      amountOutMinimum: 0n,  // handled by slippage setting
      sqrtPriceLimitX96: 0n
    }],
    value: parseEther(amountEth.toString())
  });

  return { signature: tx, chain: 'base' };
}

async function executeSellBase(tokenAddress, tokenAmount) {
  const { walletClient, publicClient, account } = getClients();
  const amountIn = BigInt(tokenAmount.toString().split('.')[0]); // Ensure integer

  // 1. Check Allowance
  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, UNISWAP_V3_ROUTER]
  });

  // 2. Approve Max if needed
  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [UNISWAP_V3_ROUTER, maxUint256]
    });
    
    // Wait for approve transaction
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // 3. Execute Swap
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);
  const tx = await walletClient.writeContract({
    address: UNISWAP_V3_ROUTER,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: tokenAddress,
      tokenOut: '0x4200000000000000000000000000000000000006',  // WETH on Base
      fee: 10000,  
      recipient: account.address,
      deadline,
      amountIn,
      amountOutMinimum: 0n, 
      sqrtPriceLimitX96: 0n
    }]
  });

  return { signature: tx, chain: 'base' };
}
