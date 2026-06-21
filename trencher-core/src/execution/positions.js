import { now, json } from '../utils.js';
import { numSetting, boolSetting, strategyById } from '../db/settings.js';
import { db } from '../db/connection.js';
import { firstPositiveNumber, marketCapFromGmgn, tokenPriceFromGmgn } from '../utils.js';
import { fetchGmgnTokenInfo } from '../enrichment/gmgn.js';
import { fetchJupiterAsset, fetchJupiterHolders, fetchJupiterChartContext, fetchJupiterWalletPnl } from '../enrichment/jupiter.js';
import { liveWalletPubkey } from '../liveExecutor.js';
import { fetchSavedWalletExposure } from '../enrichment/wallets.js';
import { filterCandidate } from '../pipeline/candidateBuilder.js';
import { openPositions } from '../db/positions.js';
import { updateCandidateSnapshot } from '../db/candidates.js';
import { trending } from '../signals/trending.js';
import { executeLiveSell } from './router.js';
import { sendPositionExit } from '../telegram/send.js';
import { setCooldown } from '../utils/mintCooldown.js';

export async function freshEntryMarket(mint, candidate) {
  const chain = candidate?.chain || 'sol';
  const gmgn = await fetchGmgnTokenInfo(mint, false, chain);
  const asset = await fetchJupiterAsset(mint, { useCache: false });
  const priceUsd = firstPositiveNumber(tokenPriceFromGmgn(gmgn), asset?.usdPrice, candidate.metrics?.priceUsd);
  const marketCapUsd = firstPositiveNumber(
    marketCapFromGmgn(gmgn),
    asset?.mcap,
    asset?.fdv,
    candidate.metrics?.marketCapUsd,
    candidate.metrics?.graduatedMarketCapUsd,
  );
  return { gmgn, asset, priceUsd, marketCapUsd, refreshedAtMs: now() };
}

export async function refreshCandidateForExecution(row) {
  const candidate = row.candidate;
  const mint = candidate.token.mint;
  const chain = candidate.chain || 'sol';
  const gmgn = await fetchGmgnTokenInfo(mint, false, chain);
  const asset = await fetchJupiterAsset(mint, { useCache: false });
  const holders = await fetchJupiterHolders(mint);
  const chart = await fetchJupiterChartContext(mint);
  const selectedTrending = trending.get(mint) || candidate.trending || null;
  const selectedHolders = holders?.holders?.length ? holders : candidate.holders;
  const selectedSavedWalletExposure = selectedHolders
    ? await fetchSavedWalletExposure(mint, selectedHolders)
    : candidate.savedWalletExposure;
  const priceUsd = firstPositiveNumber(tokenPriceFromGmgn(gmgn), asset?.usdPrice, selectedTrending?.price, candidate.metrics?.priceUsd);
  const marketCapUsd = firstPositiveNumber(
    marketCapFromGmgn(gmgn),
    asset?.mcap,
    asset?.fdv,
    selectedTrending?.market_cap,
    candidate.metrics?.marketCapUsd,
    candidate.metrics?.graduatedMarketCapUsd,
  );
  const refreshed = {
    ...candidate,
    token: {
      ...candidate.token,
      name: gmgn?.name || asset?.name || selectedTrending?.name || candidate.token.name,
      symbol: gmgn?.symbol || asset?.symbol || selectedTrending?.symbol || candidate.token.symbol,
      twitter: candidate.token.twitter || asset?.twitter || gmgn?.link?.twitter_username || selectedTrending?.twitter || '',
      website: candidate.token.website || asset?.website || gmgn?.link?.website || '',
      telegram: candidate.token.telegram || gmgn?.link?.telegram || '',
    },
    metrics: {
      ...candidate.metrics,
      priceUsd,
      marketCapUsd,
      liquidityUsd: Number(gmgn?.liquidity ?? asset?.liquidity ?? selectedTrending?.liquidity ?? candidate.metrics?.liquidityUsd ?? 0),
      holderCount: Number(gmgn?.holder_count ?? asset?.holderCount ?? selectedTrending?.holder_count ?? candidate.metrics?.holderCount ?? 0),
      gmgnTotalFeesSol: Number(gmgn?.total_fee ?? asset?.fees ?? candidate.metrics?.gmgnTotalFeesSol ?? 0),
      gmgnTradeFeesSol: Number(gmgn?.trade_fee ?? candidate.metrics?.gmgnTradeFeesSol ?? 0),
      trendingVolumeUsd: Number(selectedTrending?.volume ?? candidate.metrics?.trendingVolumeUsd ?? 0),
      trendingSwaps: Number(selectedTrending?.swaps ?? candidate.metrics?.trendingSwaps ?? 0),
      trendingHotLevel: Number(selectedTrending?.hot_level ?? candidate.metrics?.trendingHotLevel ?? 0),
      trendingSmartDegenCount: Number(selectedTrending?.smart_degen_count ?? candidate.metrics?.trendingSmartDegenCount ?? 0),
    },
    gmgn,
    jupiterAsset: asset,
    trending: selectedTrending,
    holders: selectedHolders,
    chart,
    savedWalletExposure: selectedSavedWalletExposure,
    executionRefresh: {
      refreshedAtMs: now(),
      source: 'pre_execution',
      marketCapUsd,
      priceUsd,
      liquidityUsd: Number(gmgn?.liquidity ?? asset?.liquidity ?? selectedTrending?.liquidity ?? 0),
      holdersRefreshed: Boolean(holders?.holders?.length),
    },
  };
  refreshed.filters = filterCandidate(refreshed);
  const executionFailures = [];
  if (!Number.isFinite(Number(refreshed.metrics.marketCapUsd)) || Number(refreshed.metrics.marketCapUsd) <= 0) {
    executionFailures.push('execution mcap: missing');
  }
  if (!Number.isFinite(Number(refreshed.metrics.priceUsd)) || Number(refreshed.metrics.priceUsd) <= 0) {
    executionFailures.push('execution price: missing');
  }
  if (executionFailures.length) {
    refreshed.filters = {
      ...refreshed.filters,
      passed: false,
      failures: [...(refreshed.filters?.failures || []), ...executionFailures],
    };
  }
  updateCandidateSnapshot(row.id, refreshed, refreshed.filters.passed ? 'candidate' : 'filtered');
  return { ...row, candidate: refreshed };
}

const sellInProgress = new Set();

export async function refreshPosition(position, { autoExit = true, jupiterPnl = null } = {}) {
  const asset = await fetchJupiterAsset(position.mint);
  const price = firstPositiveNumber(asset?.usdPrice, position.high_water_price, position.entry_price);
  const mcap = firstPositiveNumber(asset?.mcap, asset?.fdv, position.high_water_mcap, position.entry_mcap);
  if (!Number.isFinite(Number(mcap)) || !Number.isFinite(Number(position.entry_mcap)) || Number(position.entry_mcap) <= 0) {
    console.log(`[position] ${position.id} - Invalid mcap or entry_mcap. Forcing FAST_EXIT_RUG.`);
    return { position, exitReason: 'FAST_EXIT_RUG', pnlPercent: -100, pnlSol: -Number(position.size_sol), price: 0, mcap: 0 };
  }
  const highWaterMcap = Math.max(Number(position.high_water_mcap || 0), Number(mcap));
  const highWaterPrice = Math.max(Number(position.high_water_price || 0), Number(price || 0));
  let pnlPercent = (Number(mcap) / Number(position.entry_mcap) - 1) * 100;
  let pnlSol = Number(position.size_sol) * pnlPercent / 100;
  if (jupiterPnl && Number.isFinite(Number(jupiterPnl.totalPnlPercentageNative))) {
    pnlPercent = Number(jupiterPnl.totalPnlPercentageNative);
    pnlSol = Number.isFinite(Number(jupiterPnl.totalPnlNative)) ? Number(jupiterPnl.totalPnlNative) : pnlSol;
  }
  
  // FAST RUG DETECTION: Missing asset or totally drained liquidity
  if (!asset && (now() - position.opened_at_ms > 120000)) {
    pnlPercent = -100;
    pnlSol = -Number(position.size_sol);
  } else if (asset && Number(asset.liquidity) < 500 && (now() - position.opened_at_ms > 120000)) {
    pnlPercent = -100;
    pnlSol = -Number(position.size_sol);
  }
  const tpHit = pnlPercent >= Number(position.tp_percent);
  const slHit = pnlPercent <= Number(position.sl_percent);

  const highWaterPnlPercent = (highWaterMcap / Number(position.entry_mcap) - 1) * 100;
  const isSocialScout = position.strategy_id === 'social_scout' || position.agent_breed === 'social_scout';
  const earlyTrailingArmed = isSocialScout && highWaterPnlPercent >= 25;

  const trailingArmed = position.trailing_armed || (position.trailing_enabled && (tpHit || earlyTrailingArmed));
  const trailDrop = highWaterMcap > 0 ? (Number(mcap) / highWaterMcap - 1) * 100 : 0;
  
  // Smart Trailing: Adjust trailing stop drop based on how high the profit reached
  let dynamicTrailingPercent = Number(position.trailing_percent);
  if (highWaterPnlPercent > 100) {
    dynamicTrailingPercent = Math.max(dynamicTrailingPercent, 10); // Tighten to 10% if we are up > 2x to lock in profit
  } else if (highWaterPnlPercent > 50 && highWaterPnlPercent <= 100) {
    dynamicTrailingPercent = 10; // Standard 10% for good gains
  } else if (highWaterPnlPercent > 20 && highWaterPnlPercent <= 50) {
    dynamicTrailingPercent = 10; // Tighten to 10% for small gains to prevent total loss
  }
  
  const trailingHit = trailingArmed && position.trailing_enabled && trailDrop <= -Math.abs(dynamicTrailingPercent);
  let exitReason = null;
  let closed = false;

  // Max hold time check
  const strat = strategyById(position.strategy_id);
  
  if (position.strategy_id === 'copytrade') {
    const holdMin = (now() - position.opened_at_ms) / 60000;
    const maxHoldMs = Number(process.env.COPYTRADE_MAX_HOLD_MS || 7200000);
    if (holdMin > (maxHoldMs / 60000)) {
      exitReason = 'MAX_HOLD';
      console.log(`[copytrade] MAX HOLD on ${position.mint}`);
    } else if (pnlPercent <= Number(process.env.COPYTRADE_SAFETY_SL || -25)) {
      exitReason = 'SL_SAFETY_NET';
      console.log(`[copytrade] SAFETY SL hit on ${position.mint} at ${pnlPercent}%`);
    }
  } else if (strat?.max_hold_ms > 0 && (now() - position.opened_at_ms) >= strat.max_hold_ms) {
    exitReason = 'MAX_HOLD';
  }

  // Partial TP check
  if (!exitReason && strat?.partial_tp && !position.partial_tp_done && pnlPercent >= strat.partial_tp_at_percent) {
    db.prepare('UPDATE dry_run_positions SET partial_tp_done = 1 WHERE id = ?').run(position.id);
    console.log(`[position] ${position.id} partial TP at ${pnlPercent.toFixed(1)}% (${strat.partial_tp_sell_percent}% sell)`);
    if (position.execution_mode === 'live' && position.token_amount_raw) {
      try {
        const sellAmount = Math.floor(Number(position.token_amount_raw) * (strat.partial_tp_sell_percent / 100));
        if (sellAmount > 0) {
          const sell = await executeLiveSell({ ...position, token_amount_raw: String(sellAmount) }, 'PARTIAL_TP');
          const remaining = Number(position.token_amount_raw) - sellAmount;
          db.prepare('UPDATE dry_run_positions SET token_amount_raw = ? WHERE id = ?').run(String(remaining), position.id);
          db.prepare(`
            INSERT INTO dry_run_trades (position_id, mint, side, at_ms, price, mcap, size_sol, token_amount_est, reason, payload_json)
            VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, 'PARTIAL_TP', ?)
          `).run(position.id, position.mint, now(), price, mcap,
            position.size_sol * (strat.partial_tp_sell_percent / 100), sellAmount,
            json({ pnlPercent, sell, partialSellPercent: strat.partial_tp_sell_percent, remaining }));
          console.log(`[position] ${position.id} partial TP sold ${sellAmount} tokens, ${remaining} remaining`);
        }
      } catch (err) {
        console.log(`[position] ${position.id} partial sell failed: ${err.message}`);
      }
    }
  }

  // Fast-Exit Anti Rug check
  if (!exitReason) {
    const ageMs = now() - position.opened_at_ms;
    const firstMinDump = isSocialScout ? -10 : -15;
    // If it dumps early, exit immediately
    if (ageMs < 60000 && pnlPercent <= firstMinDump) {
      exitReason = 'FAST_EXIT_RUG';
      console.log(`[position] ${position.id} FAST EXIT TRIGGERED: ${firstMinDump}% dump in <60s`);
    } else if (ageMs < 120000 && pnlPercent <= -20) {
      exitReason = 'FAST_EXIT_RUG';
      console.log(`[position] ${position.id} FAST EXIT TRIGGERED: -20% dump in <120s`);
    } else if (pnlPercent <= -50) {
      exitReason = 'FAST_EXIT_RUG';
      console.log(`[position] ${position.id} FAST EXIT TRIGGERED: Massive dump/rug (${pnlPercent.toFixed(1)}%)`);
    }
  }

  // Standard exit checks
  if (!exitReason) {
    if (slHit) exitReason = 'SL';
    else if (tpHit && !position.trailing_enabled) exitReason = 'TP';
    else if (trailingHit) exitReason = 'TRAILING_TP';
  }

  // Live exits will override these with realized SOL values
  let finalPnlPercent = pnlPercent;
  let finalPnlSol = pnlSol;

  db.prepare(`
    UPDATE dry_run_positions
    SET high_water_mcap = ?, high_water_price = ?, trailing_armed = ?, pnl_percent = ?, pnl_sol = ?
    WHERE id = ?
  `).run(highWaterMcap, highWaterPrice, trailingArmed ? 1 : 0, pnlPercent, pnlSol, position.id);

  if (exitReason && autoExit && position.execution_mode === 'live') {
    if (sellInProgress.has(position.id)) return { ...position, exitReason: null };
    sellInProgress.add(position.id);
    let sell;
    try {
      sell = await executeLiveSell(position, exitReason);
    } catch (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes('insufficient funds') || msg.includes('not enough') || msg.includes('token balance is 0') || msg.includes('insufficient lamports')) {
         console.log(`[position] ${position.id} ${err.message}. Force closing position.`);
         db.prepare(`UPDATE dry_run_positions SET status = 'closed', closed_at_ms = ?, exit_reason = 'FORCE_CLOSE_FUNDS' WHERE id = ?`).run(now(), position.id);
         closed = true;
         exitReason = 'FORCE_CLOSE_FUNDS';
      } else if (pnlPercent <= -50) {
         console.log(`[position] ${position.id} ${err.message}. Force closing RUGGED position.`);
         db.prepare(`UPDATE dry_run_positions SET status = 'closed', closed_at_ms = ?, exit_reason = 'FORCE_CLOSE_RUGGED' WHERE id = ?`).run(now(), position.id);
         closed = true;
         exitReason = 'FORCE_CLOSE_RUGGED';
      } else {
         throw err;
      }
    } finally {
      sellInProgress.delete(position.id);
    }
    
    if (sell) {
      const receivedLamports = Number(sell.outputAmount || 0);
      const receivedSol = receivedLamports > 0 ? receivedLamports / 1_000_000_000 : null;
      if (receivedSol != null) {
        finalPnlSol = receivedSol - Number(position.size_sol);
        finalPnlPercent = (receivedSol / Number(position.size_sol) - 1) * 100;
      }
      db.prepare(`
        UPDATE dry_run_positions
        SET status = 'closed', closed_at_ms = ?, exit_price = ?, exit_mcap = ?, exit_reason = ?,
            pnl_percent = ?, pnl_sol = ?, exit_signature = ?
        WHERE id = ?
      `).run(now(), price, mcap, exitReason, finalPnlPercent, finalPnlSol, sell.signature, position.id);
      db.prepare(`
        INSERT INTO dry_run_trades (position_id, mint, side, at_ms, price, mcap, size_sol, token_amount_est, reason, payload_json)
        VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?)
      `).run(position.id, position.mint, now(), price, mcap, position.size_sol, position.token_amount_est, exitReason, json({ pnlPercent: finalPnlPercent, pnlSol: finalPnlSol, receivedSol: receivedSol ?? null, sell }));
      closed = true;
    }
  } else if (exitReason && autoExit) {
    db.prepare(`
      UPDATE dry_run_positions
      SET status = 'closed', closed_at_ms = ?, exit_price = ?, exit_mcap = ?, exit_reason = ?, pnl_percent = ?, pnl_sol = ?
      WHERE id = ?
    `).run(now(), price, mcap, exitReason, pnlPercent, pnlSol, position.id);
    db.prepare(`
      INSERT INTO dry_run_trades (position_id, mint, side, at_ms, price, mcap, size_sol, token_amount_est, reason, payload_json)
      VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?)
    `).run(position.id, position.mint, now(), price, mcap, position.size_sol, position.token_amount_est, exitReason, json({ pnlPercent, pnlSol }));
    closed = true;

    // Trigger Hatcher Webhook for dry_run SELL
    try {
      const { generateAndPushHatcherProposal } = await import('../db/hatcher.js');
      const amountLamports = position.token_amount_raw 
        ? Number(position.token_amount_raw) 
        : (position.token_amount_est ? Number(position.token_amount_est) : Math.floor(position.size_sol * 1e9));
        
      generateAndPushHatcherProposal('sell', position.mint, amountLamports, {
        lane: position.strategy_id || 'social_scout',
        caller: 'system',
        caller_trust: 'High',
        confidence: 100,
        verdict: 'SELL',
        read: exitReason || 'Automated exit',
        signals: {
          runner_signal: true
        }
      }, true);
    } catch (err) {
      console.error('[Hatcher] Failed to trigger sell webhook for dry run', err);
    }
  }
  if (closed) {
    setCooldown(position.mint, exitReason);
    // Update copytrade winrate if applicable
    if (position.strategy_id === 'copytrade' && position.copied_from) {
      const isWin = finalPnlPercent > 0;
      // db is already imported at the top of the file.
      
      db.prepare(`
        UPDATE tracked_wallets
        SET total_copied = total_copied + 1,
            total_wins = total_wins + ?,
            win_rate = CAST(total_wins + ? AS REAL) / (total_copied + 1)
        WHERE address = ?
      `).run(isWin ? 1 : 0, isWin ? 1 : 0, position.copied_from);
      
      const wallet = db.prepare('SELECT * FROM tracked_wallets WHERE address = ?').get(position.copied_from);
      if (wallet && wallet.total_copied >= 10 && wallet.win_rate < 0.30) {
        db.prepare('UPDATE tracked_wallets SET enabled = 0 WHERE address = ?').run(position.copied_from);
        console.log(`[copytrade] Wallet ${position.copied_from} auto-disabled due to low winrate: ${(wallet.win_rate*100).toFixed(0)}%`);
        import('../telegram/copytrade.js').then(({ notifyWalletDisabled }) => {
          notifyWalletDisabled(wallet.label, wallet.address, wallet.win_rate);
        }).catch(err => console.error(err));
      }
    }
    
    // 2.8 Per-KOL Accuracy Tracking
    if (position.snapshot_json) {
      try {
        const snapshot = JSON.parse(position.snapshot_json);
        const decision = snapshot.decision;
        const candidate = snapshot.candidate;
        // Check if LLM flagged a KOL
        const kol = decision?.runner_account || decision?.kol_signal;
        if (kol && kol.startsWith('@')) {
          const isWin = finalPnlPercent > 0;
          db.prepare(`
            INSERT INTO kol_accuracy (account, total_signals, winning_signals, win_rate, last_updated_ms)
            VALUES (?, 1, ?, ?, ?)
            ON CONFLICT(account) DO UPDATE SET
              total_signals = total_signals + 1,
              winning_signals = winning_signals + excluded.winning_signals,
              win_rate = CAST(winning_signals + excluded.winning_signals AS REAL) / (total_signals + 1),
              last_updated_ms = excluded.last_updated_ms
          `).run(kol, isWin ? 1 : 0, isWin ? 1.0 : 0.0, now());
          console.log(`[kol] updated accuracy for ${kol}: win=${isWin}`);
        }

        // 2.9 Social Scout: Per-TG-group win rate tracking (Sprint 4)
        // sourceMeta.groupId is written by tgListener.js into the signal broadcast
        const sourceMeta = snapshot.signal?.sourceMeta || snapshot.sourceMeta;
        if (sourceMeta?.groupId) {
          const isWin = finalPnlPercent > 0;
          try {
            const { recordGroupTradeResult, recordCallerTradeResult } = await import('../signals/tgListener.js');
            recordGroupTradeResult(sourceMeta.groupId, isWin);
            console.log(`[tg] updated group ${sourceMeta.groupId} win=${isWin} (${finalPnlPercent.toFixed(1)}%)`);
            
            if (sourceMeta.callerMeta?.callerHandle) {
               if (recordCallerTradeResult) {
                  recordCallerTradeResult(sourceMeta.callerMeta.callerHandle, isWin);
               }
            }
          } catch (tgErr) {
            console.error('[tg] recordGroupTradeResult error:', tgErr.message);
          }
        }
      } catch (err) {
        console.error('[kol] Error updating kol accuracy:', err.message);
      }
    }

  }
  return {
    ...position,
    status: closed ? 'closed' : position.status,
    closed_at_ms: closed ? now() : position.closed_at_ms,
    asset,
    price,
    mcap,
    highWaterMcap,
    high_water_mcap: highWaterMcap,
    high_water_price: highWaterPrice,
    pnlPercent: finalPnlPercent,
    pnl_percent: finalPnlPercent,
    pnlSol: finalPnlSol,
    pnl_sol: finalPnlSol,
    exitReason: closed ? exitReason : null,
    exit_reason: closed ? exitReason : position.exit_reason,
    exit_mcap: closed ? mcap : position.exit_mcap,
    exit_price: closed ? price : position.exit_price,
  };
}

export async function monitorPositions() {
  // Run Outcome Tracker for TG calls in background
  import('../signals/outcomeTracker.js').then(({ monitorCallOutcomes }) => {
    monitorCallOutcomes().catch(e => console.error('[OutcomeTracker] error:', e.message));
  }).catch(() => {});

  const positions = openPositions();
  let walletPnlData = {};
  const pubkey = liveWalletPubkey();
  if (pubkey && positions.some(p => p.execution_mode === 'live')) {
    walletPnlData = await fetchJupiterWalletPnl(pubkey);
  }
  for (const position of positions) {
    const jupiterPnl = position.execution_mode === 'live'
      ? (walletPnlData[position.mint]?.pnl || null)
      : null;
    const result = await refreshPosition(position, { autoExit: true, jupiterPnl }).catch((err) => {
      console.log(`[position] ${position.id} ${err.message}`);
      return null;
    });
    if (result?.exitReason) await sendPositionExit(result);
  }
}
