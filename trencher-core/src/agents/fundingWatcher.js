import { Connection, PublicKey } from '@solana/web3.js';
import { startAgentTradingLoop } from './agentRunner.js';

const MIN_FUNDING_SOL = 0.1;  // minimum for auto-activate

// Stub notifications since we don't have the real ones yet
function notifyAgentActivated(agent, balanceSol) {
  console.log(`[notify] Agent ${agent.name} is now LIVE with ${balanceSol.toFixed(4)} SOL`);
  const msg = `⚡ <b>Agent Auto-Activated!</b>\n\n` +
              `<b>Agent:</b> ${agent.name}\n` +
              `<b>Balance:</b> ${balanceSol.toFixed(4)} SOL\n` +
              `<b>Mode:</b> LIVE 🟢\n` +
              `<i>Trading loop is now active.</i>`;
  import('../telegram/send.js').then(({ sendTelegram }) => sendTelegram(msg)).catch(() => {});
}

function notifyAgentFunded(agent, balanceSol) {
  console.log(`[notify] Agent ${agent.name} funded with ${balanceSol.toFixed(4)} SOL but auto_activate is OFF`);
  const msg = `💰 <b>Agent Funded (Dry Run)</b>\n\n` +
              `<b>Agent:</b> ${agent.name}\n` +
              `<b>Balance:</b> ${balanceSol.toFixed(4)} SOL\n` +
              `<i>Auto-activate is OFF. Switch to LIVE manually.</i>`;
  import('../telegram/send.js').then(({ sendTelegram }) => sendTelegram(msg)).catch(() => {});
}

export function startFundingWatcher(connection, db, sharedSignalFeed) {
  console.log('[funding] watcher started');

  setInterval(async () => {
    // Fetch all dry_run agents that have a wallet
    // Assuming no status column in the schema, just check execution_mode
    const dryRunAgents = db.prepare(`
      SELECT id, name, agent_wallet, execution_mode, auto_activate, breed
      FROM agent_dna
      WHERE execution_mode = 'dry_run'
        AND agent_wallet IS NOT NULL
    `).all();

    for (const agent of dryRunAgents) {
      try {
        const balance = await connection.getBalance(new PublicKey(agent.agent_wallet));
        const balanceSol = balance / 1e9;

        if (balanceSol >= MIN_FUNDING_SOL) {
          // Auto-activate if user enabled auto_activate (default true)
          if (agent.auto_activate) {
            db.prepare(`
              UPDATE agent_dna SET execution_mode = 'live', activated_at_ms = ?
              WHERE id = ?
            `).run(Date.now(), agent.id);

            console.log(`[funding] ${agent.name} funded with ${balanceSol} SOL, auto-activated to LIVE`);
            notifyAgentActivated(agent, balanceSol);
            startAgentTradingLoop(agent.id, db, sharedSignalFeed, connection);  // kick off trading
          } else {
            // User prefers manual control, just send notification
            notifyAgentFunded(agent, balanceSol);
          }
        }
      } catch (err) {
        console.error(`[funding] error checking ${agent.id}:`, err.message);
      }
    }
  }, 60 * 1000);  // check every 60 seconds
}
