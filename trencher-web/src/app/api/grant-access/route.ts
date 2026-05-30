import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';

const TOKEN_CA = 'BuFWUxhWGJWsCCp5wEtww9YLazfUHMUJkQsuje1gpump';
const GITHUB_REPO = 'zero520-dot/autonomus-trencher-agent';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.login) {
      return NextResponse.json({ error: 'Not authenticated with GitHub' }, { status: 401 });
    }

    const githubUsername = (session.user as any).login;

    const body = await req.json();
    const { publicKey, signature, message } = body;

    if (!publicKey || !signature || !message) {
      return NextResponse.json({ error: 'Missing signature parameters' }, { status: 400 });
    }

    // 1. Verify Signature
    const pubKeyBuffer = new PublicKey(publicKey).toBytes();
    const signatureBuffer = bs58.decode(signature);
    const messageBuffer = new TextEncoder().encode(message);

    const isVerified = nacl.sign.detached.verify(messageBuffer, signatureBuffer, pubKeyBuffer);
    if (!isVerified) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // 2. Check Token Balance (Must be >= 1% of Total Supply)
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!, 'confirmed');
    const mintPublicKey = new PublicKey(TOKEN_CA);
    const userPublicKey = new PublicKey(publicKey);

    // Get Total Supply
    const supplyResponse = await connection.getTokenSupply(mintPublicKey);
    const totalSupply = Number(supplyResponse.value.amount); // using raw amount because decimals might vary
    
    // Get User Balance
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(userPublicKey, {
      mint: mintPublicKey,
    });

    let userBalance = 0;
    if (tokenAccounts.value.length > 0) {
      userBalance = tokenAccounts.value.reduce((acc, accountInfo) => {
        return acc + Number(accountInfo.account.data.parsed.info.tokenAmount.amount);
      }, 0);
    }

    // Calculate 1% Threshold
    const minimumRequired = totalSupply * 0.01;

    if (userBalance < minimumRequired) {
      return NextResponse.json({ 
        error: `Insufficient balance. You need at least 1% of the total supply. Your balance: ${userBalance}, Required: ${minimumRequired}` 
      }, { status: 403 });
    }

    // 3. Grant GitHub Access
    const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/collaborators/${githubUsername}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ permission: 'read' })
    });

    if (!githubResponse.ok) {
      const errorData = await githubResponse.json();
      console.error('GitHub API Error:', errorData);
      return NextResponse.json({ error: 'Failed to invite to GitHub repository.' }, { status: 500 });
    }

    // 4. Save to Supabase
    const { error: dbError } = await supabase
      .from('github_holders')
      .upsert({ 
        github_username: githubUsername, 
        wallet_address: publicKey,
        last_verified_at: new Date().toISOString(),
        is_active: true
      }, { onConflict: 'github_username' });

    if (dbError) {
      console.error('Supabase DB Error:', dbError);
      // We still return success but log the error, or you can fail here if strict consistency is needed.
    }

    return NextResponse.json({ success: true, message: 'Successfully granted GitHub access!' });

  } catch (error: any) {
    console.error('Grant Access Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
