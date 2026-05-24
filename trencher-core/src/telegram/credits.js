import axios from 'axios';
import { bot } from './bot.js';

export async function sendCreditsInfo(chatId) {
  const msgInfo = await bot.sendMessage(chatId, '⏳ Memeriksa status dan saldo API keys...');
  
  let report = '📊 <b>API Keys Status & Credits</b>\n\n';

  // 1. Check DeepSeek (has balance endpoint)
  try {
    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (!dsKey) {
      report += '<b>DeepSeek (Worker):</b> ➖ Not Configured\n';
    } else {
      const res = await axios.get('https://api.deepseek.com/user/balance', {
        headers: { 'Authorization': `Bearer ${dsKey}` },
        timeout: 5000
      });
      const balanceInfo = res.data?.balance_infos?.[0];
      if (balanceInfo) {
        report += `<b>DeepSeek (Worker):</b> ✅ Active\n└ Saldo: $${balanceInfo.total_balance} ${balanceInfo.currency}\n`;
      } else {
        report += `<b>DeepSeek (Worker):</b> ✅ Active (Saldo tidak diketahui)\n`;
      }
    }
  } catch (err) {
    if (err.response?.status === 402) {
      report += `<b>DeepSeek (Worker):</b> ❌ Out of Credits\n`;
    } else {
      report += `<b>DeepSeek (Worker):</b> ⚠️ Error (${err.response?.status || err.message})\n`;
    }
  }

  report += '\n';

  // 2. Check Anthropic / Claude (No balance endpoint, use dummy request)
  try {
    const claudeKey = process.env.LLM_API_KEY;
    if (!claudeKey) {
      report += '<b>Claude (Conductor):</b> ➖ Not Configured\n';
    } else {
      const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: process.env.LLM_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      }, {
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 5000
      });
      report += `<b>Claude (Conductor):</b> ✅ Active (Credits OK)\n`;
    }
  } catch (err) {
    const errorData = err.response?.data?.error;
    if (err.response?.status === 400 && errorData?.message?.toLowerCase().includes('credit balance is too low')) {
      report += `<b>Claude (Conductor):</b> ❌ Out of Credits (Saldo Habis!)\n`;
    } else if (err.response?.status === 403 || err.response?.status === 429) {
      report += `<b>Claude (Conductor):</b> ❌ Quota Exceeded / Out of Credits\n`;
    } else {
      report += `<b>Claude (Conductor):</b> ⚠️ Error (${err.response?.status || err.message})\n`;
    }
  }

  report += '\n';

  // 3. Check Grok (No balance endpoint, use models request)
  try {
    const grokKey = process.env.GROK_API_KEY;
    if (!grokKey) {
      report += '<b>Grok (Critic):</b> ➖ Not Configured\n';
    } else {
      await axios.get('https://api.x.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${grokKey}` },
        timeout: 5000
      });
      report += `<b>Grok (Critic):</b> ✅ Active (API Key Valid)\n`;
    }
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      report += `<b>Grok (Critic):</b> ❌ Invalid Key or Out of Credits\n`;
    } else {
      report += `<b>Grok (Critic):</b> ⚠️ Error (${err.response?.status || err.message})\n`;
    }
  }

  report += '\n<i>Catatan: Claude dan Grok tidak memiliki endpoint API untuk mengecek nominal saldo secara langsung, sehingga bot hanya melakukan uji (ping) untuk memastikan kunci API masih hidup dan memiliki kuota.</i>';

  await bot.editMessageText(report, {
    chat_id: chatId,
    message_id: msgInfo.message_id,
    parse_mode: 'HTML'
  });
}
