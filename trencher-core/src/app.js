import { setDefaultResultOrder } from 'node:dns';
import { APP_NAME, SIGNAL_SERVER_URL, SIGNAL_POLL_MS, GRADUATED_POLL_MS, TRENDING_POLL_MS, POSITION_CHECK_MS, validateConfig } from './config.js';
import { initDb } from './db/connection.js';
import { initLiveExecution } from './liveExecutor.js';
import { setupTelegram } from './telegram/commands.js';
import { monitorPositions } from './execution/positions.js';
import { processCandidateFromSignals, maybeProcessDegenCandidate } from './pipeline/orchestrator.js';
import { sendTelegram } from './telegram/send.js';
import { makeFailureTracker } from './utils.js';
import { clearExpiredCooldowns } from './utils/mintCooldown.js';

setDefaultResultOrder('ipv4first');
validateConfig();

export async function startTrencherAgent() {
  initDb();
  const { ensureGenesisAgent } = await import('./db/agentDna.js');
  ensureGenesisAgent();
  initLiveExecution();
  setupTelegram();
  
  // Start the Auto-Burn Cron Job
  const { initBurnCron } = await import('./jobs/burnCron.js');
  initBurnCron();
  
  // Start WebSocket server and passive state manager
  // NOTE: consciousness stream (CONSCIOUSNESS_DECISION) is broadcast
  // through this same server — no separate port needed.
  const { startWsServer } = await import('./server/wsServer.js');
  startWsServer(process.env.PORT || 4001);
  await import('./server/stateManager.js');

  if (SIGNAL_SERVER_URL) {
    // ── Server mode: fetch signals from signal server ──────────────────────
    const { fetchServerSignals, setCandidateHandler, setDegenHandler } = await import('./signals/serverClient.js');

    setCandidateHandler(processCandidateFromSignals);
    setDegenHandler(maybeProcessDegenCandidate);

    const alert = (msg) => sendTelegram(msg);
    const trackServer = makeFailureTracker('server signals', alert);
    const trackDip = makeFailureTracker('dip monitor', alert);

    let consecutiveFailures = 0;
    let standaloneFallbackActive = false;

    async function startStandaloneFallback() {
      if (standaloneFallbackActive) return;
      standaloneFallbackActive = true;
      console.log(`[bot] SIGNAL SERVER DOWN! Falling back to Standalone Mode (local scanning)...`);
      await sendTelegram('⚠️ <b>Signal Server Down!</b>\nTrencher Agent secara otomatis mengaktifkan <b>Standalone Mode (Lokal)</b> sebagai cadangan agar terus memindai koin.');

      const { fetchGraduatedCoins } = await import('./signals/graduated.js');
      const { fetchGmgnTrending } = await import('./signals/trending.js');
      const { startWebsocket } = await import('./signals/feeClaim.js');

      await fetchGraduatedCoins().catch(error => console.log(`[graduated] fallback fetch failed: ${error.message}`));
      await fetchGmgnTrending().catch(error => console.log(`[trending] fallback fetch failed: ${error.message}`));

      setInterval(() => fetchGraduatedCoins().catch(error => console.log(`[graduated] ${error.message}`)), GRADUATED_POLL_MS);
      setInterval(() => fetchGmgnTrending().catch(error => console.log(`[trending] ${error.message}`)), TRENDING_POLL_MS);
      startWebsocket();
    }

    async function pollSignals() {
      try {
        await fetchServerSignals();
        if (consecutiveFailures > 0) {
          console.log(`[server] Signal server connection healthy. Consecutive failures reset.`);
          consecutiveFailures = 0;
        }
      } catch (error) {
        consecutiveFailures++;
        console.log(`[server] Fetch failed (${consecutiveFailures}/3): ${error.message}`);
        if (consecutiveFailures >= 3 && !standaloneFallbackActive) {
          await startStandaloneFallback();
        }
        throw error;
      }
    }

    await pollSignals().catch(error => console.log(`[server] initial fetch failed: ${error.message}`));
    setInterval(() => trackServer(() => pollSignals()), SIGNAL_POLL_MS);

    // Price monitor for dip buy strategy
    const { monitorPriceAlerts, cleanupAlerts } = await import('./signals/priceMonitor.js');
    const { setCandidateHandler: setAlertHandler } = await import('./signals/priceMonitor.js');
    setAlertHandler(processCandidateFromSignals);
    setInterval(() => trackDip(() => monitorPriceAlerts()), 10_000);
    setInterval(() => cleanupAlerts(), 60 * 60 * 1000);

    console.log(`[bot] ${APP_NAME} started (server mode: ${SIGNAL_SERVER_URL})`);
  } else {
    // ── Standalone mode: direct polling (legacy) ───────────────────────────
    const { fetchGraduatedCoins } = await import('./signals/graduated.js');
    const { fetchGmgnTrending, setDegenHandler } = await import('./signals/trending.js');
    const { startWebsocket, setCandidateHandler } = await import('./signals/feeClaim.js');

    setDegenHandler(maybeProcessDegenCandidate);
    setCandidateHandler(processCandidateFromSignals);

    await fetchGraduatedCoins().catch(error => console.log(`[graduated] initial fetch failed: ${error.message}`));
    await fetchGmgnTrending().catch(error => console.log(`[trending] initial fetch failed: ${error.message}`));

    setInterval(() => fetchGraduatedCoins().catch(error => console.log(`[graduated] ${error.message}`)), GRADUATED_POLL_MS);
    setInterval(() => fetchGmgnTrending().catch(error => console.log(`[trending] ${error.message}`)), TRENDING_POLL_MS);
    startWebsocket();

    console.log(`[bot] ${APP_NAME} started (standalone mode)`);
  }

  // Position monitoring runs in both modes
  const trackPositions = makeFailureTracker('position monitor', (msg) => sendTelegram(msg));
  setInterval(() => trackPositions(() => monitorPositions()), POSITION_CHECK_MS);

  // Clear expired mint cooldowns every hour
  setInterval(() => clearExpiredCooldowns(), 60 * 60 * 1000);

  // Periodically clean up old DB records to prevent unbounded growth
  const { cleanupDatabase } = await import('./db/cleanup.js');
  setInterval(() => cleanupDatabase(), 12 * 60 * 60 * 1000);
  cleanupDatabase(); // Run once on startup
}
