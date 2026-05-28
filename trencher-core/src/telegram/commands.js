import { bot } from './bot.js';
import { TELEGRAM_CHAT_ID } from '../config.js';
import { now, json } from '../utils.js';
import { escapeHtml, fmtPct } from '../format.js';
import { db } from '../db/connection.js';
import { numSetting, boolSetting, setSetting, activeStrategy, setActiveStrategy, strategyById, updateStrategyConfig } from '../db/settings.js';
import { candidateById, latestCandidateByMint, updateCandidateStatus } from '../db/candidates.js';
import { storeDecision, logDecisionEvent } from '../db/decisions.js';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');
import {
  menuKeyboard,
  filtersText,
  filtersKeyboard,
  agentText,
  agentKeyboard,
  navKeyboard,
  mainMenuText,
  walletsText,
  positionsText,
  candidateButtons,
  positionButtons,
  strategyMenuText,
  strategyKeyboard,
} from './menus.js';
import { sendTelegram, sendBatch, sendPositionOpen } from './send.js';
import { candidateSummary, formatPosition } from './format.js';
import { refreshPosition } from '../execution/positions.js';
import { executeLiveSell } from '../execution/router.js';
import { handleCallback, editMenuMessage } from './callbacks.js';
import { consumeNumericFilterInput } from './input.js';
import { runLearning, sendLessons } from '../learning/commands.js';
import { fetchWalletPnl } from '../enrichment/wallets.js';
import { sendCreditsInfo } from './credits.js';
import { setCooldown, clearCooldown, activeCooldowns } from '../utils/mintCooldown.js';

export async function handleMessage(msg) {
  if (String(msg.chat.id) !== String(TELEGRAM_CHAT_ID)) {
    console.log(`[security] Blocked message from unauthorized chat: ${msg.chat.id}`);
    return;
  }
  const text = (msg.text || '').trim();
  const chatId = msg.chat.id;
  if (await consumeNumericFilterInput(chatId, text, msg.message_id)) return;
  if (!text.startsWith('/')) return;
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const helpText = `🤖 <b>Trencher Agent - Command List</b>

<b>Interactive Menus:</b>
/menu - Buka menu utama interaktif
/positions - Lihat posisi trading aktif
/wallets - Lihat daftar dompet target yang dipantau

<b>Settings & Strategies:</b>
/strategy - Ganti dan atur strategi trading
/stratset &lt;id&gt; &lt;key&gt; &lt;value&gt; - Ubah konfigurasi strategi spesifik
/filters - Lihat pengaturan filter saat ini
/setfilter &lt;key&gt; &lt;value&gt; - Ubah pengaturan secara manual

<b>Wallet Management:</b>
/walletadd &lt;name&gt; &lt;address&gt; - Tambah target (mata-mata)
/walletremove &lt;name&gt; - Hapus target
/setwallet &lt;private_key&gt; - Masukkan Private Key eksekusi (Aman: Pesan dihapus otomatis)
/balance - Cek dompet aktif & saldo SOL

<b>Information & History:</b>
/candidate &lt;mint&gt; - Tampilkan info spesifik koin
/history - Lihat 10 riwayat transaksi terakhir
/pnl - Ringkasan profit & loss
/credits - Cek status kuota & saldo API (Claude, Grok, DeepSeek, X)
/exportdb - Download file database lengkap

<b>Social Media & Integrations:</b>
/twitter - Cek status & atur auto-posting X (Twitter)

<b>Cooldown Anti-Rebuy:</b>
/cooldowns - Lihat daftar token yang sedang cooldown
/cooldown_clear &lt;mint&gt; - Hapus cooldown token tertentu

<b>Learning:</b>
/learn &lt;window&gt; - Analisis trade & buat pelajaran (misal: /learn 12h)
/lessons - Lihat pelajaran aktif`;
    return bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
  }
  if (text.startsWith('/balance')) {
    const { liveWalletPubkey, liveWalletBalanceLamports } = await import('../liveExecutor.js');
    const pubkey = liveWalletPubkey();
    if (!pubkey) {
      return bot.sendMessage(chatId, '❌ Belum ada Wallet Eksekusi yang aktif.\\nGunakan /setwallet <private_key> untuk menambahkan.');
    }
    const msgInfo = await bot.sendMessage(chatId, '⏳ Mengecek saldo di Solana...');
    try {
      const lamports = await liveWalletBalanceLamports();
      const sol = (lamports / 1000000000).toFixed(4);
      return bot.editMessageText(`💰 <b>Wallet Eksekusi Aktif:</b>\\n<code>${pubkey}</code>\\n\\n<b>Saldo:</b> ${sol} SOL`, { chat_id: chatId, message_id: msgInfo.message_id, parse_mode: 'HTML' });
    } catch (err) {
      return bot.editMessageText(`❌ Gagal mengecek saldo: ${err.message}`, { chat_id: chatId, message_id: msgInfo.message_id });
    }
  }
  if (text.startsWith('/exportdb')) {
    const { DB_PATH } = await import('../config.js');
    const statusMsg = await bot.sendMessage(chatId, '⏳ Menyiapkan export database...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tmpSqlite = path.resolve(`./export-tmp-${timestamp}.sqlite`);
    const tmpZip = path.resolve(`./export-tmp-${timestamp}.zip`);
    let sizeMB = '0.00';
    let keepZip = false;
    try {
      // Checkpoint WAL then VACUUM into a clean copy
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.prepare(`VACUUM INTO ?`).run(tmpSqlite);

      // Compress to zip
      await new Promise((resolve, reject) => {
        const output = createWriteStream(tmpZip);
        const archive = new ZipArchive({ zlib: { level: 9 } });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.file(tmpSqlite, { name: 'trencher-agent.sqlite' });
        archive.finalize();
      });

      const zipStat = fs.statSync(tmpZip);
      sizeMB = (zipStat.size / 1024 / 1024).toFixed(2);

      await bot.editMessageText(`⏳ Mengirim file (${sizeMB} MB)...`, {
        chat_id: chatId, message_id: statusMsg.message_id,
      });

      await bot.sendDocument(chatId, tmpZip, {
        caption: `📦 trencher-agent.sqlite — ${timestamp}\nUkuran: ${sizeMB} MB\nBuka menggunakan DB Browser for SQLite atau DBeaver.`,
      });

      await bot.editMessageText(`✅ Database berhasil dikirim (${sizeMB} MB).`, {
        chat_id: chatId, message_id: statusMsg.message_id,
      });
    } catch (err) {
      if (err.message.includes('413') || err.message.includes('Too Large')) {
        const domain = process.env.RAILWAY_PUBLIC_DOMAIN || 'APP_URL';
        const downloadUrl = `https://${domain}/download/export-tmp-${timestamp}.zip`;
        
        await bot.editMessageText(`⏳ File terlalu besar untuk Telegram (${sizeMB} MB).`, {
          chat_id: chatId, message_id: statusMsg.message_id,
        }).catch(() => {});
        
        await bot.sendMessage(chatId, `📦 <b>trencher-agent.sqlite</b> — ${timestamp}\nUkuran: ${sizeMB} MB\n\n⬇️ <b>Direct Download Link:</b>\n${downloadUrl}\n\n<i>Note: Ekstrak zip lalu buka file .sqlite menggunakan DB Browser for SQLite atau DBeaver.</i>`, { parse_mode: 'HTML' }).catch(() => {});
        
        // Only unlink the sqlite, KEEP the zip so it can be downloaded via HTTP
        fs.unlink(tmpSqlite, () => {});
        keepZip = true;
        return;
      } else {
        await bot.editMessageText(`❌ Gagal export database: ${err.message}`, {
          chat_id: chatId, message_id: statusMsg.message_id,
        }).catch(() => {});
      }
    } finally {
      fs.unlink(tmpSqlite, () => {});
      if (!keepZip) fs.unlink(tmpZip, () => {});
    }
    return;
  }
  if (text.startsWith('/history')) return sendHistory(chatId);
  if (text.startsWith('/credits')) return sendCreditsInfo(chatId);
  if (text.startsWith('/twitter')) {
    const args = text.split(/\s+/);
    if (args.length === 2 && (args[1] === 'on' || args[1] === 'off')) {
      const val = args[1] === 'on' ? 'true' : 'false';
      setSetting('twitter_bot_enabled', val);
      return bot.sendMessage(chatId, val === 'true' ? '✅ Auto-posting Twitter Master dihidupkan.' : '❌ Auto-posting Twitter Master dimatikan.');
    }
    
    if (args.length === 3) {
      const type = args[1];
      const state = args[2];
      
      const validTypes = {
        open: 'twitter_open',
        close: 'twitter_close',
        daily: 'twitter_daily',
        screening: 'twitter_screening'
      };
      
      if (validTypes[type] && (state === 'on' || state === 'off')) {
        setSetting(validTypes[type], state === 'on' ? 'true' : 'false');
        return bot.sendMessage(chatId, `✅ Twitter post untuk <b>${type}</b> diatur ke <b>${state.toUpperCase()}</b>.`, { parse_mode: 'HTML' });
      }
    }
    
    const master = boolSetting('twitter_bot_enabled', true) ? 'ON' : 'OFF';
    const openSt = boolSetting('twitter_open', process.env.TWEET_ON_OPEN === 'true') ? 'ON' : 'OFF';
    const closeSt = boolSetting('twitter_close', process.env.TWEET_ON_CLOSE === 'true') ? 'ON' : 'OFF';
    const dailySt = boolSetting('twitter_daily', process.env.TWEET_ON_DAILY_SUMMARY === 'true') ? 'ON' : 'OFF';
    const screenSt = boolSetting('twitter_screening', process.env.TWEET_ON_SCREENING === 'true') ? 'ON' : 'OFF';
    
    return bot.sendMessage(chatId, `🛠 <b>Twitter Settings</b>\n\n` +
      `Master Toggle: <b>${master}</b>\n` +
      `• Open Pos: <b>${openSt}</b>\n` +
      `• Close Pos: <b>${closeSt}</b>\n` +
      `• Daily: <b>${dailySt}</b>\n` +
      `• Screening: <b>${screenSt}</b>\n\n` +
      `<b>Cara mengubah:</b>\n` +
      `/twitter &lt;on|off&gt;\n` +
      `/twitter &lt;open|close|daily|screening&gt; &lt;on|off&gt;`, { parse_mode: 'HTML' });
  }
  if (text.startsWith('/cooldown_clear')) {
    const mint = text.split(/\s+/)[1];
    if (!mint) return bot.sendMessage(chatId, 'Usage: /cooldown_clear <mint address>');
    clearCooldown(mint);
    return bot.sendMessage(chatId, `✅ Cooldown dihapus untuk ${mint.slice(0, 8)}...\nMint ini bisa dibeli lagi.`);
  }
  if (text.startsWith('/cooldowns')) {
    const list = activeCooldowns();
    if (!list.length) return bot.sendMessage(chatId, '✅ Tidak ada cooldown aktif.\nSemua token bisa dibeli.');
    const lines = list.map(c => {
      const remaining = Math.max(0, c.cooldown_until_ms - now());
      const mins = Math.ceil(remaining / 60000);
      return `• <code>${c.mint.slice(0, 8)}...</code> — ${c.exit_reason} — ${mins}m tersisa`;
    });
    return bot.sendMessage(chatId, `⏳ <b>Cooldown Aktif (${list.length})</b>\n\n${lines.join('\n')}\n\nGunakan /cooldown_clear <mint> untuk menghapus.`, { parse_mode: 'HTML' });
  }
  if (text.startsWith('/menu')) return sendMenu(chatId);
  if (text.startsWith('/positions')) return sendPositions(chatId);
  if (text.startsWith('/filters')) return bot.sendMessage(chatId, filtersText(), { parse_mode: 'HTML' });
  if (text.startsWith('/strategy')) {
    const parts = text.split(/\s+/);
    const id = parts[1];
    if (!id) {
      return bot.sendMessage(chatId, strategyMenuText(), { parse_mode: 'HTML', ...strategyKeyboard() });
    }
    const valid = ['sniper', 'dip_buy', 'smart_money', 'degen'];
    if (!valid.includes(id)) {
      return bot.sendMessage(chatId, `Unknown strategy. Valid: ${valid.join(', ')}`);
    }
    setActiveStrategy(id);
    return bot.sendMessage(chatId, strategyMenuText(), { parse_mode: 'HTML', ...strategyKeyboard() });
  }
  if (text.startsWith('/stratset')) {
    const parts = text.split(/\s+/);
    const [, id, key, ...rest] = parts;
    const value = rest.join(' ');
    if (!id || !key || !value) {
      return bot.sendMessage(chatId, 'Usage: /stratset <strategy_id> <key> <value>\n\nExample: /stratset sniper tp_percent 75\n\nKeys: tp_percent, sl_percent, position_size_sol, max_open_positions, min_mcap_usd, max_mcap_usd, min_holders, trailing_enabled, trailing_percent, partial_tp, partial_tp_at_percent, partial_tp_sell_percent, max_hold_ms, use_llm, llm_min_confidence, min_source_count, require_fee_claim, min_fee_claim_sol, min_gmgn_total_fee_sol, max_ath_distance_pct');
    }
    const strat = strategyById(id);
    if (!strat) return bot.sendMessage(chatId, `Strategy "${id}" not found.`);
    const numKeys = new Set(['tp_percent', 'sl_percent', 'position_size_sol', 'max_open_positions', 'min_mcap_usd', 'max_mcap_usd', 'min_holders', 'max_top20_holder_percent', 'trailing_percent', 'partial_tp_at_percent', 'partial_tp_sell_percent', 'max_hold_ms', 'llm_min_confidence', 'min_source_count', 'min_fee_claim_sol', 'min_gmgn_total_fee_sol', 'max_ath_distance_pct', 'token_age_max_ms', 'trending_min_volume_usd', 'trending_min_swaps', 'trending_max_rug_ratio', 'trending_max_bundler_rate', 'min_saved_wallet_holders', 'min_graduated_volume_usd']);
    const boolKeys = new Set(['trailing_enabled', 'partial_tp', 'use_llm', 'require_fee_claim']);
    const newConfig = { ...strat };
    delete newConfig.id;
    delete newConfig.name;
    if (numKeys.has(key)) {
      newConfig[key] = Number(value);
    } else if (boolKeys.has(key)) {
      newConfig[key] = value === 'true' || value === '1' || value === 'yes';
    } else {
      newConfig[key] = value;
    }
    updateStrategyConfig(id, newConfig);
    return bot.sendMessage(chatId, `Updated ${id}.${key} = ${value}\n\n${strategyMenuText()}`, { parse_mode: 'HTML' });
  }
  if (text.startsWith('/pnl')) return sendPnl(chatId);
  if (text.startsWith('/learn')) {
    const windowArg = text.split(/\s+/)[1] || '12h';
    return runLearning(chatId, windowArg);
  }
  if (text.startsWith('/lessons')) return sendLessons(chatId);
  if (text.startsWith('/candidate')) {
    const mint = text.split(/\s+/)[1];
    if (!mint) return bot.sendMessage(chatId, 'Usage: /candidate <mint>');
    const row = latestCandidateByMint(mint);
    if (!row) return bot.sendMessage(chatId, 'Candidate not found.');
    return sendCandidate(chatId, row.id);
  }
  if (text.startsWith('/setwallet')) {
    const pk = text.split(/\s+/)[1];
    bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    if (!pk) return bot.sendMessage(chatId, 'Usage: /setwallet <base58_private_key>\n\n(Your message was deleted for security)');
    setSetting('solana_private_key', pk);
    import('../liveExecutor.js').then(({ initLiveExecution }) => initLiveExecution());
    return bot.sendMessage(chatId, '✅ Wallet Private Key successfully updated and loaded into Live Executor.\n\n(Your message containing the key was automatically deleted for security).');
  }
  if (text.startsWith('/walletadd')) {
    const [, label, address] = text.split(/\s+/);
    if (!label || !address) return bot.sendMessage(chatId, 'Usage: /walletadd <label> <address>');
    db.prepare(`
      INSERT INTO saved_wallets (label, address, created_at_ms) VALUES (?, ?, ?)
      ON CONFLICT(label) DO UPDATE SET address = excluded.address
    `).run(label, address, now());
    return bot.sendMessage(chatId, `Saved wallet ${label}.`);
  }
  if (text.startsWith('/walletremove')) {
    const label = text.split(/\s+/)[1];
    if (!label) return bot.sendMessage(chatId, 'Usage: /walletremove <label>');
    db.prepare('DELETE FROM saved_wallets WHERE label = ?').run(label);
    return bot.sendMessage(chatId, `Removed ${label}.`);
  }
  if (text.startsWith('/wallets')) return handleCallback({ id: 'manual', data: 'menu:wallets', message: { chat: { id: chatId } } });
  if (text.startsWith('/setfilter')) {
    const { key, value } = parseSetFilter(text);
    const valid = new Set([
      'min_fee_claim_sol',
      'min_mcap_usd',
      'max_mcap_usd',
      'min_gmgn_total_fee_sol',
      'min_graduated_volume_usd',
      'max_top20_holder_percent',
      'min_saved_wallet_holders',
      'trending_enabled',
      'trending_source',
      'trending_allow_degen',
      'trending_interval',
      'trending_limit',
      'trending_order_by',
      'trending_min_volume_usd',
      'trending_min_swaps',
      'trending_max_rug_ratio',
      'trending_max_bundler_rate',
      'trading_mode',
      'llm_min_confidence',
      'llm_candidate_pick_count',
      'llm_candidate_max_age_ms',
      'max_open_positions',
      'dry_run_buy_sol',
      'default_tp_percent',
      'default_sl_percent',
      'default_trailing_enabled',
      'default_trailing_percent',
      'cooldown_rebuy_ms',
    ]);
    if (!valid.has(key) || value == null) {
      return bot.sendMessage(chatId, `Usage: /setfilter &lt;name&gt; &lt;value&gt;\n\n${filtersText()}`, { parse_mode: 'HTML' });
    }
    setSetting(key, value === 'off' ? '0' : value);
    return bot.sendMessage(chatId, filtersText(), { parse_mode: 'HTML' });
  }
}

export async function sendCandidate(chatId, id) {
  const row = candidateById(id);
  if (!row) return bot.sendMessage(chatId, 'Candidate not found.');
  const decision = db.prepare('SELECT * FROM llm_decisions WHERE candidate_id = ? ORDER BY id DESC LIMIT 1').get(id);
  await bot.sendMessage(chatId, candidateSummary(row.candidate, decision), {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...candidateButtons(id, decision),
  });
}

export async function sendPositions(chatId) {
  const rows = allPositions(12);
  const text = rows.length ? rows.map(formatPosition).join('\n\n') : 'No dry-run positions yet.';
  await bot.sendMessage(chatId, `📍 <b>Positions</b>\n\n${text}`, { parse_mode: 'HTML', disable_web_page_preview: true });
}

export async function sendPosition(chatId, id, query = null) {
  let row = db.prepare('SELECT * FROM dry_run_positions WHERE id = ?').get(id);
  if (!row) return bot.sendMessage(chatId, 'Position not found.');
  if (row.status === 'open') {
    const refreshed = await refreshPosition(row, { autoExit: row.execution_mode !== 'live' }).catch((err) => {
      console.log(`[position] refresh ${id} ${err.message}`);
      return null;
    });
    if (refreshed) row = { ...row, ...refreshed };
  }
  const buttons = row.status === 'open' ? positionButtons(id) : {};
  if (query) return editMenuMessage(query, formatPosition(row), buttons);
  await bot.sendMessage(chatId, formatPosition(row), { parse_mode: 'HTML', disable_web_page_preview: true, ...buttons });
}

export async function sendHistory(chatId) {
  const rows = db.prepare("SELECT * FROM dry_run_positions WHERE status = 'closed' ORDER BY closed_at_ms DESC LIMIT 10").all();
  if (!rows.length) return bot.sendMessage(chatId, 'Belum ada riwayat transaksi yang selesai.');
  
  const text = rows.map(r => {
    const symbol = r.mint.slice(0, 8);
    const pnl = Number(r.pnl_percent || 0).toFixed(2);
    const sign = pnl > 0 ? '🟢' : (pnl < 0 ? '🔴' : '⚪');
    return `${sign} <b>${symbol}</b>: ${pnl > 0 ? '+' : ''}${pnl}% (${escapeHtml(r.exit_reason || 'closed')})`;
  }).join('\\n');
  
  await bot.sendMessage(chatId, `📜 <b>10 Riwayat Transaksi Terakhir:</b>\\n\\n${text}`, { parse_mode: 'HTML' });
}

export async function closePosition(chatId, id, reason) {
  const row = db.prepare('SELECT * FROM dry_run_positions WHERE id = ?').get(id);
  if (!row || row.status !== 'open') return bot.sendMessage(chatId, 'Open position not found.');
  const result = await refreshPosition(row, { autoExit: false });
  const price = result?.price ?? row.high_water_price ?? row.entry_price;
  const mcap = result?.mcap ?? row.high_water_mcap ?? row.entry_mcap;
  const pnlPercent = row.entry_mcap ? (Number(mcap) / Number(row.entry_mcap) - 1) * 100 : 0;
  const pnlSol = Number(row.size_sol) * pnlPercent / 100;
  let sell = null;
  if (row.execution_mode === 'live') sell = await executeLiveSell(row, reason);
  db.prepare(`
    UPDATE dry_run_positions
    SET status = 'closed', closed_at_ms = ?, exit_price = ?, exit_mcap = ?, exit_reason = ?,
        pnl_percent = ?, pnl_sol = ?, exit_signature = ?
    WHERE id = ?
  `).run(now(), price, mcap, reason, pnlPercent, pnlSol, sell?.signature || null, id);
  db.prepare(`
    INSERT INTO dry_run_trades (position_id, mint, side, at_ms, price, mcap, size_sol, token_amount_est, reason, payload_json)
    VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, row.mint, now(), price, mcap, row.size_sol, row.token_amount_est, reason, json({ pnlPercent, pnlSol, sell }));
  const label = row.execution_mode === 'live' ? 'Closed live position' : 'Closed dry-run position';
  setCooldown(row.mint, reason);
  await bot.sendMessage(chatId, `${label} #${id}: ${escapeHtml(reason)} ${fmtPct(pnlPercent)}`, { parse_mode: 'HTML' });
}

export async function updatePositionRule(chatId, id, field, nextValue, query = null) {
  if (!Number.isFinite(nextValue)) return bot.sendMessage(chatId, 'Invalid value.');
  db.prepare(`UPDATE dry_run_positions SET ${field} = ? WHERE id = ?`).run(nextValue, id);
  const row = db.prepare('SELECT * FROM dry_run_positions WHERE id = ?').get(id);
  if (row) {
    db.prepare(`
      INSERT INTO tp_sl_rules (position_id, tp_percent, sl_percent, trailing_enabled, trailing_percent, updated_at_ms)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(position_id) DO UPDATE SET
        tp_percent = excluded.tp_percent,
        sl_percent = excluded.sl_percent,
        trailing_enabled = excluded.trailing_enabled,
        trailing_percent = excluded.trailing_percent,
        updated_at_ms = excluded.updated_at_ms
    `).run(id, row.tp_percent, row.sl_percent, row.trailing_enabled, row.trailing_percent, now());
  }
  await sendPosition(chatId, id, query);
}

export async function toggleTrailing(chatId, id, query = null) {
  const row = db.prepare('SELECT * FROM dry_run_positions WHERE id = ?').get(id);
  if (!row) return bot.sendMessage(chatId, 'Position not found.');
  const next = row.trailing_enabled ? 0 : 1;
  db.prepare('UPDATE dry_run_positions SET trailing_enabled = ? WHERE id = ?').run(next, id);
  db.prepare(`
    INSERT INTO tp_sl_rules (position_id, tp_percent, sl_percent, trailing_enabled, trailing_percent, updated_at_ms)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(position_id) DO UPDATE SET
      tp_percent = excluded.tp_percent,
      sl_percent = excluded.sl_percent,
      trailing_enabled = excluded.trailing_enabled,
      trailing_percent = excluded.trailing_percent,
      updated_at_ms = excluded.updated_at_ms
  `).run(id, row.tp_percent, row.sl_percent, next, row.trailing_percent, now());
  await sendPosition(chatId, id, query);
}

export function setupTelegram() {
  bot.setMyCommands([
    { command: 'start', description: 'Show all shortcut commands' },
    { command: 'menu', description: 'Open Trencher Agent menu' },
    { command: 'strategy', description: 'Show/switch strategy' },
    { command: 'stratset', description: 'Set strategy config (stratset id key value)' },
    { command: 'positions', description: 'Show dry-run positions' },
    { command: 'candidate', description: 'Show candidate by mint' },
    { command: 'filters', description: 'Show filters' },
    { command: 'pnl', description: 'Show saved-wallet PnL' },
    { command: 'learn', description: 'Run manual learning report' },
    { command: 'lessons', description: 'Show active screening lessons' },
    { command: 'setfilter', description: 'Set a filter value' },
    { command: 'walletadd', description: 'Save wallet for exposure/PnL' },
    { command: 'walletremove', description: 'Remove saved wallet' },
    { command: 'wallets', description: 'List saved wallets' },
    { command: 'setwallet', description: 'Set live execution private key' },
    { command: 'balance', description: 'Check live wallet balance' },
    { command: 'history', description: 'Show last 10 trades' },
    { command: 'exportdb', description: 'Download sqlite database' },
    { command: 'twitter', description: 'Enable/disable auto Twitter post' },
  ]).catch(err => console.log(`[telegram] commands ${err.message}`));

  bot.on('callback_query', query => handleCallback(query).catch(err => console.log(`[callback] ${err.message}`)));
  bot.on('message', msg => handleMessage(msg).catch(err => console.log(`[message] ${err.message}`)));
  bot.on('polling_error', err => {
    if (err.message.includes('ECONNRESET') || err.message.includes('EFATAL')) return;
    console.log(`[telegram] polling ${err.message}`);
  });
}

async function sendMenu(chatId = TELEGRAM_CHAT_ID) {
  const { TELEGRAM_TOPIC_ID } = await import('../config.js');
  await bot.sendMessage(chatId, mainMenuText(), {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(TELEGRAM_TOPIC_ID ? { message_thread_id: Number(TELEGRAM_TOPIC_ID) } : {}),
    ...menuKeyboard(),
  });
}

export async function sendPnl(chatId, query = null) {
  const wallets = savedWallets();
  if (!wallets.length) {
    const text = '📊 <b>PnL</b>\n\nNo saved wallets. Use /walletadd &lt;label&gt; &lt;address&gt;.';
    return query ? editMenuMessage(query, text, navKeyboard()) : bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }
  const chunks = [];
  for (const wallet of wallets) {
    const pnl = await fetchWalletPnl(wallet.address).catch(() => null);
    if (!pnl) {
      chunks.push(`• <b>${escapeHtml(wallet.label)}</b>: no data`);
      continue;
    }
    chunks.push([
      `• <b>${escapeHtml(wallet.label)}</b>`,
      `Win: ${fmtPct(pnl.winRate)} · PnL: ${fmtPct(pnl.totalPnlPercent)}`,
      `Trades: ${pnl.totalTrades} · Wins: ${pnl.wins}`,
    ].join('\n'));
  }
  const text = `📊 <b>PnL</b>\n\n${chunks.join('\n\n')}`;
  return query ? editMenuMessage(query, text, navKeyboard()) : bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

function parseSetFilter(text) {
  const parts = text.trim().split(/\s+/);
  return { key: parts[1], value: parts[2] };
}

function allPositions(limit = 10) {
  return db.prepare('SELECT * FROM dry_run_positions ORDER BY id DESC LIMIT ?').all(limit);
}

function savedWallets() {
  return db.prepare('SELECT * FROM saved_wallets ORDER BY label').all();
}
