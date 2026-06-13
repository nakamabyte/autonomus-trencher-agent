/**
 * Hatcher Labs Pilot - End-to-End Test Script
 * 
 * Usage Instructions:
 * 1. Ensure Trencher Core is running (npm run start).
 * 2. Open a new terminal and run: node scripts/test-hatcher.js
 */

const API_URL = process.env.API_URL || 'http://localhost:4001/partner/v1/agents';
const API_KEY = process.env.HATCHER_PARTNER_API_KEY || 'htc_8x9fp2a';
const AGENT_ID = process.env.HATCHER_AGENT_ID || 'a72032da-6de4-4a3c-b235-dbf138ed8a87';
const HEADERS = {
  'Authorization': `Bearer hatcher_${API_KEY}`,
  'Content-Type': 'application/json'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('================================================');
  console.log('🚀 STARTING HATCHER LABS INTEGRATION TEST 🚀');
  console.log('================================================\n');

  try {
    // 1. Check Initial Status
    console.log('1️⃣  [GET] /status - Checking initial agent status...');
    let res = await fetch(`${API_URL}/${AGENT_ID}/status`, { headers: HEADERS });
    let data = await res.json();
    console.log('Response:', data, '\n');

    // 2. Update Caps & Wallet Pubkey
    console.log('2️⃣  [PUT] /caps - Configuring risk caps and registering dynamic wallet...');
    res = await fetch(`${API_URL}/${AGENT_ID}/caps`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        max_trade_bps_of_wallet: 75, // 0.75%
        max_daily_loss_bps: 400,
        max_open_positions: 3,
        wallet_pubkey: "Hz7xXYZT123dummyWalletForTestingOnly"
      })
    });
    data = await res.json();
    console.log('Response:', data, '\n');

    // 3. Re-check Status to ensure Caps and Pubkey are saved
    console.log('3️⃣  [GET] /status - Verifying Caps and Pubkey were saved successfully...');
    res = await fetch(`${API_URL}/${AGENT_ID}/status`, { headers: HEADERS });
    data = await res.json();
    console.log('Response:', data, '\n');

    // 4. Poll Proposal (May be empty if no recent signals)
    console.log('4️⃣  [GET] /propose - Polling for JIT transaction proposal...');
    res = await fetch(`${API_URL}/${AGENT_ID}/propose`, { headers: HEADERS });
    data = await res.json();
    console.log('Response:', data);
    if (data.status === 'no_proposals') {
      console.log('=> (This is expected if Trencher has not made any recent purchases)\n');
    } else {
      console.log('=> (Proposal found! Blockhash is guaranteed fresh via JIT)\n');
      
      // Simulate execution if proposal is found
      console.log('5️⃣  [POST] /executed - Reporting that Hatcher has signed the transaction...');
      const execRes = await fetch(`${API_URL}/${AGENT_ID}/executed`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          proposal_id: data.proposal_id,
          status: "signed_submitted",
          tx_signature: "5xyzDummySignatureTest",
          reason: "Testing OK"
        })
      });
      const execData = await execRes.json();
      console.log('Response:', execData, '\n');
    }

    // 6. Test Kill Switch
    console.log('6️⃣  [POST] /kill - Simulating market panic (Kill Switch)...');
    res = await fetch(`${API_URL}/${AGENT_ID}/kill`, { method: 'POST', headers: HEADERS });
    data = await res.json();
    console.log('Response:', data, '\n');

    console.log('7️⃣  [GET] /propose - Verifying polling is rejected when Killed...');
    res = await fetch(`${API_URL}/${AGENT_ID}/propose`, { headers: HEADERS });
    console.log('HTTP Status:', res.status, '(Should be 403 Forbidden)');
    data = await res.json();
    console.log('Response:', data, '\n');

    // 8. Test Revive
    console.log('8️⃣  [POST] /revive - Reviving the agent...');
    res = await fetch(`${API_URL}/${AGENT_ID}/revive`, { method: 'POST', headers: HEADERS });
    data = await res.json();
    console.log('Response:', data, '\n');

    console.log('✅ TESTING COMPLETED!');
    
  } catch (err) {
    console.error('❌ TESTING FAILED:', err.message);
    console.log('Ensure Trencher server (npm run start) is running on port 4001.');
  }
}

runTest();
