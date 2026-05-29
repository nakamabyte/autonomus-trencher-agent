import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';

const TOKEN_CA = 'BuFWUxhWGJWsCCp5wEtww9YLazfUHMUJkQsuje1gpump';
const GITHUB_REPO = 'zero520-dot/autonomus-trencher-agent';

// This function can run for a long time depending on how many users there are.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Secure the cron endpoint using a secret token
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all registered users from Supabase
    const { data: users, error: dbError } = await supabase
      .from('github_holders')
      .select('*');

    if (dbError || !users) {
      return NextResponse.json({ error: 'Failed to fetch users from database' }, { status: 500 });
    }

    if (users.length === 0) {
      return NextResponse.json({ message: 'No users to check' });
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!, 'confirmed');
    const mintPublicKey = new PublicKey(TOKEN_CA);

    // 2. Fetch Total Supply once to compare
    const supplyResponse = await connection.getTokenSupply(mintPublicKey);
    const totalSupply = Number(supplyResponse.value.amount);
    const minimumRequired = totalSupply * 0.01;

    let revokedCount = 0;

    // 3. Check balances and revoke if necessary
    for (const user of users) {
      try {
        const userPublicKey = new PublicKey(user.wallet_address);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(userPublicKey, {
          mint: mintPublicKey,
        });

        let userBalance = 0;
        if (tokenAccounts.value.length > 0) {
          userBalance = Number(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount);
        }

        if (userBalance < minimumRequired) {
          console.log(`User ${user.github_username} (${user.wallet_address}) balance ${userBalance} is below 1% threshold (${minimumRequired}). Revoking access.`);
          
          // Revoke GitHub Access
          const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/collaborators/${user.github_username}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28',
            }
          });

          if (!githubResponse.ok && githubResponse.status !== 404) {
            console.error(`Failed to remove ${user.github_username} from GitHub`, await githubResponse.text());
          }

          // Remove from Supabase
          await supabase
            .from('github_holders')
            .delete()
            .eq('github_username', user.github_username);
            
          revokedCount++;
        }
      } catch (err) {
        console.error(`Failed to check/revoke user ${user.github_username}:`, err);
        // Continue with the next user even if one fails
      }
    }

    return NextResponse.json({ success: true, message: `Checked ${users.length} users. Revoked ${revokedCount} users.` });

  } catch (error: any) {
    console.error('Cron Check Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
