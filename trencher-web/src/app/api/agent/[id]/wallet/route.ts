import { NextResponse } from 'next/server';

// Mock implementations since Next.js route cannot directly import from trencher-core 
// without proper monorepo setup or relative paths that reach outside the app.
// In a real integration, this would call the core db and agentWallet functions.

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  
  // Example response for balance
  return NextResponse.json({
    success: true,
    agentId: id,
    walletAddress: 'MockWalletAddress123',
    balanceSol: 0.15
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();
  
  if (body.action === 'withdraw') {
    const { amountSol, destinationAddress } = body;
    
    // Example response for withdrawal
    return NextResponse.json({
      success: true,
      agentId: id,
      withdrawn: amountSol,
      destination: destinationAddress,
      txHash: 'mock_tx_hash_123'
    });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
