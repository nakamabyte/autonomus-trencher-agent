import fetch from 'node-fetch';
import { canSpendApiBudget, recordApiSpend } from '../filters/risk.js';
import { PAYSH_SPEND_WALLET_KEY } from '../config.js';

/**
 * Parses L402 challenge header like:
 * L402 macaroon="...", invoice="..."
 */
function parseL402Challenge(authHeader) {
  if (!authHeader) return null;
  const match = authHeader.match(/L402 macaroon="([^"]+)", invoice="([^"]+)"/);
  if (match) {
    return { macaroon: match[1], invoice: match[2] };
  }
  return null;
}

/**
 * fetchWithPaySh wraps the standard fetch API to automatically handle 
 * "402 Payment Required" responses by paying the associated L402 invoice.
 */
export async function fetchWithPaySh(url, options = {}, costUsdcEstimate = 0.05, provider = "unknown") {
  // 1. Initial attempt
  const response = await fetch(url, options);

  // 2. Intercept 402
  if (response.status === 402) {
    const authHeader = response.headers.get('www-authenticate');
    const challenge = parseL402Challenge(authHeader);

    if (!challenge) {
      console.error(`[paysh-client] Received 402 but no valid L402 challenge header from ${url}`);
      return response; // Return original 402
    }

    // 3. Check kill switch
    if (!canSpendApiBudget(costUsdcEstimate)) {
      console.warn(`[paysh-client] Skipped 402 payment to ${provider} due to budget cap.`);
      return response; 
    }

    // 4. Pay the invoice via Pay.sh spend wallet
    // In production, we would decode the invoice to verify amount, then send Solana SPL transfer.
    // For this implementation, we mock the payment signature.
    console.log(`[paysh-client] Triggering payment of ${costUsdcEstimate} USDC to ${provider} via Pay.sh`);
    const paymentSignature = `paysh_sig_${Date.now()}`;
    
    // Log the spend
    recordApiSpend(costUsdcEstimate, provider, `paid 402 for ${url}`, paymentSignature);

    // 5. Retry with L402 auth header
    const retryOptions = { ...options };
    retryOptions.headers = {
      ...retryOptions.headers,
      'Authorization': `L402 ${challenge.macaroon}:${paymentSignature}`
    };

    console.log(`[paysh-client] Retrying request to ${url} with L402 Authorization`);
    return await fetch(url, retryOptions);
  }

  // If not 402, return immediately
  return response;
}
