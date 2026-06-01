import { bot } from './bot.js';
import { TELEGRAM_CHAT_ID } from '../config.js';

export function notifyCopyBuy(signal, size, txHash) {
  const text = `
⚡ *COPY BUY*

Copied: ${signal.wallet.slice(0,8)}...
🪙 ${signal.symbol || signal.mint.slice(0,8)}
💰 Size: ${size} SOL
🔗 \`${signal.mint}\`

🛑 Safety SL: -25%
🪞 Mirror exit: ON

[tx](https://solscan.io/tx/${txHash})
─────────────────
_Autonomous Trencher Agent_
`.trim();

  bot.sendMessage(TELEGRAM_CHAT_ID, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  }).catch(err => console.error('[telegram] notifyCopyBuy error:', err.message));
}

export function notifyMirrorSell(signal, position, txHash) {
  const text = `
🪞 *MIRROR SELL*

Target wallet exited — following
🪙 ${position.symbol || position.mint.slice(0,8)}
${(position.pnl_percent || 0) > 0 ? '🟢' : '🔴'} ${(position.pnl_percent || 0) > 0 ? '+' : ''}${(position.pnl_percent || 0).toFixed(2)}%

[tx](https://solscan.io/tx/${txHash})
─────────────────
_Autonomous Trencher Agent_
`.trim();

  bot.sendMessage(TELEGRAM_CHAT_ID, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  }).catch(err => console.error('[telegram] notifyMirrorSell error:', err.message));
}

export function notifyWalletDisabled(walletLabel, address, winRate) {
  const text = `
⚠️ *AUTO-DISABLE WALLET*

Wallet ${walletLabel || address.slice(0,8)} has been auto-disabled.
Reason: Win Rate fell below 30% (${(winRate*100).toFixed(0)}%).
You can evaluate it again and re-add it if needed.
`.trim();

  bot.sendMessage(TELEGRAM_CHAT_ID, text, { parse_mode: 'Markdown' }).catch(() => {});
}
