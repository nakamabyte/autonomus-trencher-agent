import { passesFreshLaunchGate } from '../src/filters/freshLaunchGate.js';
import * as walletTracker from '../src/enrichment/walletTracker.js';

// Wallet tracker now natively supports 'rugger' for testing purposes

async function runTests() {
  const token = { creator: 'good_dev' };
  let passedCount = 0;
  
  const assert = (condition, msg) => {
    if (!condition) console.error(msg);
    else passedCount++;
  };

  // Test 1: Mcap below floor
  let result = await passesFreshLaunchGate(token, { mcap_usd: 4000 });
  assert(result.pass === false, 'Test 1 Failed');
  
  // Test 2: Mcap above ceiling
  result = await passesFreshLaunchGate(token, { mcap_usd: 35000 });
  assert(result.pass === false, 'Test 2 Failed');
  
  // Test 3: High dev holding
  result = await passesFreshLaunchGate(token, { mcap_usd: 10000, dev_holding_pct: 20 });
  assert(result.pass === false, 'Test 3 Failed');
  
  // Test 4: High bundler rate
  result = await passesFreshLaunchGate(token, { mcap_usd: 10000, dev_holding_pct: 5, bundler_rate: 0.15 });
  assert(result.pass === false, 'Test 4 Failed');
  
  // Test 5: Known rugger
  const badToken = { creator: 'rugger' };
  result = await passesFreshLaunchGate(badToken, { mcap_usd: 10000, dev_holding_pct: 5, bundler_rate: 0.05 });
  assert(result.pass === false, 'Test 5 Failed');
  
  // Test 6: Pure noise (no signals)
  result = await passesFreshLaunchGate(token, { mcap_usd: 10000, dev_holding_pct: 5, bundler_rate: 0.05 });
  assert(result.pass === false, 'Test 6 Failed');
  
  // Test 7: Valid token with runner signal
  result = await passesFreshLaunchGate(token, { mcap_usd: 10000, dev_holding_pct: 5, bundler_rate: 0.05, runner_signal: true });
  assert(result.pass === true, 'Test 7 Failed');

  console.log(`Tests completed. Passed: ${passedCount}/7`);
}

runTests().catch(console.error);
